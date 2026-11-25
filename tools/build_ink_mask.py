"""Bake the preview's fractal/radial diffusion once, instead of filtering live text every frame."""
from pathlib import Path
import numpy as np
from PIL import Image

WIDTH,HEIGHT,COLS,ROWS=256,96,8,16
rng=np.random.default_rng(7)
y,x=np.mgrid[0:HEIGHT,0:WIDTH].astype(np.float32)
noise=np.zeros((HEIGHT,WIDTH),dtype=np.float32)
for frequency,weight in [(5,.56),(11,.28),(23,.16)]:
    grid=rng.random((frequency+2,frequency+2)).astype(np.float32)
    gx=x/WIDTH*frequency;gy=y/HEIGHT*frequency
    ix=gx.astype(int);iy=gy.astype(int)
    ux=gx-ix;uy=gy-iy
    ux=ux*ux*(3-2*ux);uy=uy*uy*(3-2*uy)
    noise+=weight*((1-uy)*((1-ux)*grid[iy,ix]+ux*grid[iy,ix+1])+uy*((1-ux)*grid[iy+1,ix]+ux*grid[iy+1,ix+1]))
field=np.sqrt(((x/WIDTH-.5)*1.5)**2+((y/HEIGHT-.5)*.9)**2)+(noise-.5)*.28
field=(field-field.min())/(field.max()-field.min())
atlas=np.full((HEIGHT*ROWS,WIDTH*COLS,4),255,dtype=np.uint8)
for frame in range(COLS*ROWS):
    p=frame/(COLS*ROWS-1)
    alpha=np.clip((p*1.12-.06-field)/.06+.5,0,1)
    alpha=alpha*alpha*(3-2*alpha)
    if frame==0:alpha[:]=0
    if frame==COLS*ROWS-1:alpha[:]=1
    row,col=divmod(frame,COLS)
    atlas[row*HEIGHT:(row+1)*HEIGHT,col*WIDTH:(col+1)*WIDTH,3]=(alpha*255).astype(np.uint8)
target=Path(__file__).resolve().parents[1]/'ui/ink-mask.png'
Image.fromarray(atlas).save(target,optimize=True)
print(f'{target.name}: {target.stat().st_size:,} bytes, {COLS*ROWS} cached diffusion frames')
