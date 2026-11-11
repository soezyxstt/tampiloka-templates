import type { CartLine } from '../domain/contract';
export interface LocalCart {lines:CartLine[];voucherCode:string;customerId:string;method:string;amount:string;reference:string;sourceId:string;paymentId:string;}
export const emptyCart=():LocalCart=>({lines:[],voucherCode:'',customerId:'',method:'cash',amount:'',reference:'',sourceId:'',paymentId:''});
interface StorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void;}
export function cartStorageKey(scope:string,userId:string,locationId:string) {
 if(!/^[a-f0-9]{64}$/.test(scope)||!userId||!locationId)throw new Error('recovery_scope_invalid');
 return `tl-operations-cart-v2:${JSON.stringify([scope,userId,locationId])}`;
}
function valid(value:unknown):value is LocalCart {
 if(!value||typeof value!=='object')return false;
 const c=value as LocalCart;
 return Array.isArray(c.lines)&&c.lines.length<=500&&c.lines.every(l=>l&&typeof l.productId==='string'&&Number.isFinite(l.quantity)&&l.quantity>=0&&(l.unit===undefined||typeof l.unit==='string'))
 &&['voucherCode','customerId','method','amount','reference','sourceId','paymentId'].every(k=>typeof c[k as keyof LocalCart]==='string');
}
export function loadCart(key:string,storage:StorageLike=localStorage):LocalCart {
 let raw:string|null;try{raw=storage.getItem(key);}catch{throw new Error('recovery_storage_unavailable');}
 if(raw===null)return emptyCart();
 try{const envelope=JSON.parse(raw);if(envelope.version!==1||!valid(envelope.cart))throw new Error();return envelope.cart;}catch{throw new Error('recovery_storage_invalid');}
}
export function storeCart(key:string,cart:LocalCart,storage:StorageLike=localStorage) {
 if(!valid(cart))throw new Error('invalid_cart_draft');
 const serialized=JSON.stringify({version:1,cart});
 try{storage.setItem(key,serialized);if(storage.getItem(key)!==serialized)throw new Error();}catch{throw new Error('recovery_storage_unavailable');}
}
