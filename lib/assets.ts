import { optimizedAssets } from './optimized-assets';
// Bundled assets must follow the current host (old preview hosts, Vercel, najd.ps or Netlify).
const OWN_HOSTS=/^https?:\/\/(?:najd-cosmetics\.glassyplume\.chatgpt\.site|(?:www\.)?najd\.ps|najd-zubi[a-z0-9-]*\.vercel\.app|najd-zubi\.netlify\.app)\/(images|brand|products)\//i;
// Local product photos are served as compressed .webp copies to cut bandwidth.
export function portableAssetUrl(url:string){
 const local=url.replace(OWN_HOSTS,'/$1/');
 const cut=local.search(/[?#]/);
 const path=cut<0?local:local.slice(0,cut),rest=cut<0?'':local.slice(cut);
 return optimizedAssets.has(path)?path.replace(/\.(png|jpe?g)$/i,'.webp')+rest:local;
}
