import type { Metadata } from 'next';
import { siteOrigin,storeDescription,storeTitle } from '../lib/seo';
import './globals.css';
export const metadata:Metadata={...(siteOrigin?{metadataBase:new URL(siteOrigin)}:{}),title:storeTitle,description:storeDescription,icons:{icon:{url:'/brand/nz-tab-v2.svg',type:'image/svg+xml'}}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
