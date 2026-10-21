// Minimal dependency-free JPEG/TIFF EXIF parser: date, camera, embedded GPS.
// For unsupported formats, no EXIF is claimed. Original bytes remain unchanged.
window.readSurveyExif = async function(file) {
  const result = { capturedAt: null, camera: null, gps: null };
  if (file.type !== 'image/jpeg') return result;
  const b = new DataView(await file.slice(0,Math.min(file.size, 262144)).arrayBuffer());
  if (b.byteLength < 8 || b.getUint16(0) !== 0xffd8) return result;
  let pos=2, tiff=-1;
  while(pos+4<b.byteLength){if(b.getUint8(pos)!==255)break;let marker=b.getUint8(pos+1),len=b.getUint16(pos+2);if(marker===225 && pos+10<b.byteLength && String.fromCharCode(...new Uint8Array(b.buffer,pos+4,4))==='Exif'){tiff=pos+10;break;}if(len<2)break;pos+=len+2;}
  if(tiff<0||tiff+8>b.byteLength)return result;
  try{
    const little=b.getUint16(tiff)===0x4949;if(!little&&b.getUint16(tiff)!==0x4d4d)return result;
    const u16=p=>b.getUint16(p,little),u32=p=>b.getUint32(p,little);
    if(u16(tiff+2)!==42)return result;
    const size={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
    function entries(offset){const p=tiff+offset;if(p+2>b.byteLength)return {};const n=Math.min(u16(p),100);const out={};for(let i=0;i<n;i++){const q=p+2+i*12;if(q+12>b.byteLength)break;const tag=u16(q),type=u16(q+2),count=u32(q+4),byteLen=(size[type]||1)*count;const value=byteLen<=4?q+8:tiff+u32(q+8);if(value<0||value+byteLen>b.byteLength)continue;out[tag]={type,count,value};}return out;}
    const text=e=>e?new TextDecoder('ascii').decode(new Uint8Array(b.buffer,e.value,e.count)).replace(/\0/g,'').trim():null;
    const num=e=>{if(!e)return null;return e.type===3?u16(e.value):u32(e.value)};
    const rational=(e,i=0)=>{if(!e||e.value+8*i+8>b.byteLength)return NaN;const p=e.value+i*8;const d=u32(p+4);return d?u32(p)/d:NaN;};
    const zero=entries(u32(tiff+4));const make=text(zero[0x010f]),model=text(zero[0x0110]);result.camera=[make,model].filter(Boolean).join(' ').trim()||null;
    const exif=entries(num(zero[0x8769])||0);const date=text(exif[0x9003])||text(zero[0x0132]);
    if(date&&/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) result.capturedAt=date.slice(0,10).replaceAll(':','-')+'T'+date.slice(11);
    const gps=entries(num(zero[0x8825])||0);const lat=gps[2],lng=gps[4],latRef=text(gps[1]),lngRef=text(gps[3]);
    if(lat&&lng&&lat.count===3&&lng.count===3){const dd=e=>rational(e,0)+rational(e,1)/60+rational(e,2)/3600;let latitude=dd(lat),longitude=dd(lng);if(latRef==='S')latitude=-latitude;if(lngRef==='W')longitude=-longitude;if(Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180)result.gps={latitude,longitude,source:'exif'};}
  }catch(e){console.warn('EXIF not read',e);}return result;
};
