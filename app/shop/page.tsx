import CommerceStore from '../commerce-store';
import {pageMetadata,privateShopView,shopTitle,shopDescription} from '../../lib/seo';
export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const privateView=privateShopView(await searchParams);
 return pageMetadata(privateView?'حسابك وطلباتك | NAJD ZUBI':shopTitle,privateView?'إدارة حسابك وسلة التسوق ومتابعة طلباتك في متجر نجد.':shopDescription,'/shop',undefined,!privateView);
}
export default function ShopPage(){return <CommerceStore/>}
