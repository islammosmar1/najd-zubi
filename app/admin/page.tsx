import { redirect } from 'next/navigation';
export const metadata={title:'إدارة المتجر | NAJD ZUBI',description:'تسجيل الدخول لإدارة المتجر.',robots:{index:false,follow:false}};
export default function AdminPage(){redirect('/shop?admin=1')}
