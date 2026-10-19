// Bundled assets must follow the current host when exporting to Vercel.
export function portableAssetUrl(url:string){return url.replace(/^https:\/\/najd-cosmetics\.glassyplume\.chatgpt\.site\/(images|brand)\//,'/$1/')}
