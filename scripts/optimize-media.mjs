import sharp from 'sharp';
import { mkdir, stat, writeFile } from 'node:fs/promises';
const mappings = [
  ['images/elephant-skin.png','elephant-skin.webp',1400,82],
  ['images/IVORY_Barbers_Logo.png','logo.webp',600,88],
  ...['beard','brush','chiskop','fade','trim','custom cut'].map(n=>[`images/services/${n}.png`,`services/${n==='custom cut'?'custom':n}.webp`,720,82]),
  ...['Ashley','CEO','Kylie','PRO','Steve'].map(n=>[`images/team/${n}.png`,`team/${n.toLowerCase()}.webp`,800,83])
];
const report=[];
for (const [src,dst,width,quality] of mappings) {
  await mkdir(`public/media/${dst.includes('/')?dst.split('/')[0]:''}`,{recursive:true});
  const meta = await sharp(`public/${src}`).metadata();
  await sharp(`public/${src}`).resize({width,withoutEnlargement:true}).webp({quality}).toFile(`public/media/${dst}`);
  report.push({original:`public/${src}`,width:meta.width,height:meta.height,optimized:`public/media/${dst}`,bytes:(await stat(`public/media/${dst}`)).size});
}
await mkdir('docs',{recursive:true});
await writeFile('docs/media-manifest.json',JSON.stringify(report,null,2));
console.log(`Preserved ${report.length} supplied images; optimized total ${Math.round(report.reduce((sum,r)=>sum+r.bytes,0)/1024)} KB.`);
