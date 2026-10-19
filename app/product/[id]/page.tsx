import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicProduct } from '../../../lib/public-catalog-server';
import { pageMetadata } from '../../../lib/seo';
import Shop from '../../commerce-store';
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {id}=await params;const product=await getPublicProduct(id);
 if(!product)return {title:'المنتج غير متوفر | NAJD',robots:{index:false,follow:false}};
 const title=(product.data.name?.ar||'منتج نجد')+' | NAJD COSMETICS';
 const description=(product.data.description?.ar||'اكتشفي تفاصيل المنتج من متجر نجد.').slice(0,180);
 const path='/product/'+encodeURIComponent(id);
 return pageMetadata(title,description,path,product.data.images?.[0],!product.data.isSample);
}
export default async function ProductPage({params}:Props){const {id}=await params;if(!await getPublicProduct(id))notFound();return <Shop productId={id}/>}
