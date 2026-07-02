import csv, re, json, sys
from datetime import datetime

SRC = sys.argv[1] if len(sys.argv)>1 else 'Music_Videos_2efd23161c3c4f84bb0bfbee2b825593_all.csv'

with open(SRC, encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

def yt_id(url):
    if not url: return None
    m = re.search(r'(?:v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})', url); return m.group(1) if m else None
def vim_id(url):
    if not url: return None
    m = re.search(r'vimeo\.com/(?:video/)?(\d+)', url); return m.group(1) if m else None
def slugify(a,s):
    base=f"{a}-{s}".lower(); base=re.sub(r"['\"“”’]",'',base)
    base=re.sub(r'[^a-z0-9]+','-',base).strip('-'); return base[:60]
def parse_date(d):
    d=d.strip()
    if not d: return None,None,None
    for fmt in ('%B %d, %Y','%B %Y','%Y'):
        try:
            dt=datetime.strptime(d,fmt)
            if fmt=='%B %d, %Y': return dt.strftime('%Y-%m-%d'),dt.strftime('%B %Y'),dt.year
            if fmt=='%B %Y': return dt.strftime('%Y-%m-01'),dt.strftime('%B %Y'),dt.year
            return f'{dt.year}-01-01',str(dt.year),dt.year
        except ValueError: continue
    return None,d,None

def clean_director(d):
    d=d.strip()
    # drop URLs sitting in the director field (data errors)
    if re.match(r'https?://', d):
        # keep any trailing name after a URL+separator, e.g. "https://... and Mike Maguire"
        d=re.sub(r'https?://\S+', '', d)
    d=re.sub(r'https?://\S+','',d)
    # strip parenthetical annotations: (animation: ...), (Creative Director: ...), handles
    d=re.sub(r'\([^)]*\)','',d)
    d=re.sub(r'\s*[-–]\s*@[\w.]+','',d)
    d=re.sub(r'\s*@[\w.]+','',d)
    # collapse leftover separators/whitespace and stray leading commas
    d=re.sub(r'^\s*[,/&]+\s*','',d)
    d=re.sub(r'^\s*(and|&)\s+','',d, flags=re.I)  # dangling "and X" after URL removal
    d=re.sub(r'\s{2,}',' ',d).strip().strip(',').strip()
    # non-breaking spaces
    d=d.replace('\xa0',' ').strip()
    return d

videos={}; skipped=0
for r in rows:
    yt=yt_id(r.get('YouTube','')); vm=vim_id(r.get('Vimeo',''))
    if not yt and not vm: skipped+=1; continue
    artist=r.get('Artist','').strip(); song=r.get('Song','').strip()
    if not artist or not song: skipped+=1; continue
    sort_date,display,year=parse_date(r.get('Release Date',''))
    tags=[t.strip() for t in r.get('Tags','').split(',') if t.strip()]
    director=clean_director(r.get('Director','').strip())
    # OPTION 1: whole director string is ONE name. never split.
    directors=[director] if director else []
    slug=slugify(artist,song); orig=slug; n=2
    while slug in videos: slug=f'{orig}-{n}'; n+=1
    primary='youtube' if yt else 'vimeo'
    thumb=f'https://img.youtube.com/vi/{yt}/hqdefault.jpg' if yt else None
    videos[slug]={
        'id':slug,'artist':artist,'song':song,
        'director':director,'directors':directors,
        'dateDisplay':display,'sortDate':sort_date or '9999-99-99','year':year,
        'provider':primary,'youtubeId':yt,'vimeoId':vm,
        'thumbnailUrl':thumb,'tags':tags,
    }

ordered=sorted(videos.values(),key=lambda v:(v['sortDate'],v['artist'].lower()))
timeline=[v['id'] for v in ordered]
def group(field,multi=False):
    g={}
    for v in ordered:
        vals=v[field] if multi else [v[field]]
        for val in vals:
            if not val: continue
            g.setdefault(val,[]).append(v['id'])
    return g
tags_pl=group('tags',True); artists_pl=group('artist'); directors_pl=group('directors',True)
counts={'tags':{k:len(v) for k,v in tags_pl.items()},
        'artists':{k:len(v) for k,v in artists_pl.items()},
        'directors':{k:len(v) for k,v in directors_pl.items()}}
data={'meta':{'title':'Thunder/Lightning','subtitle':'A Love Letter to Music Videos',
        'totalVideos':len(videos),'totalArtists':len(artists_pl),
        'totalDirectors':len(directors_pl),'totalTags':len(tags_pl)},
      'videos':videos,
      'playlists':{'timeline':timeline,'tags':tags_pl,'artists':artists_pl,'directors':directors_pl},
      'counts':counts}
json.dump(data,open('/home/claude/videos.json','w'),indent=2,ensure_ascii=False)
open('/home/claude/videos.min.json','w').write(json.dumps(data,ensure_ascii=False,separators=(',',':')))

print(f'Playable: {len(videos)} | skipped: {skipped}')
print(f'Artists: {len(artists_pl)} | Directors: {len(directors_pl)} | Tags: {len(tags_pl)}')
# verify AB/CD/CD is now intact
print()
print('AB/CD/CD check:', 'AB/CD/CD' in directors_pl, '(should be True = kept whole)')
print('No fake CD director:', 'CD' not in directors_pl, '(should be True)')
# spot-check other tricky ones
for name in ['Dom & Nic','Hammer & Tongs','Kijek/Adamski','Hugo & Marie']:
    print(f'  {name!r} intact:', name in directors_pl)
# any URL leaked into directors?
urls=[d for d in directors_pl if 'http' in d]
print('URLs leaked into directors:', urls if urls else 'none')
