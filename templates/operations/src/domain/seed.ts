import rawConfig from '../../config/operations.json' with { type: 'json' };
import { validateInstallation } from '../../config/validate.ts';
const baseConfig = validateInstallation(rawConfig);
import type { OperationsState, Role, Location, Product, User } from './contract.ts';
export const personas = ['owner','inventory','receiver','cashier','pricing','auditor','mixed'] as const;
export function createInitialState(demo: boolean, now = new Date().toISOString(), preset: 'food'|'retail'|'supplies' = baseConfig.preset): OperationsState {
 const config=structuredClone(baseConfig);
 if(demo&&preset!=='food'){
  const retail=preset==='retail';
  config.business={...config.business,id:`${baseConfig.business.id}-demo-${preset}`,name:retail?'Ruang Ritel':'Bekal Kantor'};
  config.products=retail?[
   {id:'cotton-shirt',sku:'KAOS-KATUN-M',name:'Kaos Katun Ukuran M',variant:'Natural / M',baseUnit:'pcs',units:{pcs:1,lusin:12},fractional:false,active:true},
   {id:'canvas-bag',sku:'TAS-KANVAS',name:'Tas Kanvas',variant:'Natural',baseUnit:'pcs',units:{pcs:1,pak:6},fractional:false,active:true}
  ]:[
   {id:'paper-a4',sku:'KERTAS-A4-80',name:'Kertas A4 80 gsm',variant:'Putih / 500 lembar',baseUnit:'rim',units:{rim:1,karton:5},fractional:false,active:true},
   {id:'black-pen',sku:'PENA-HITAM-05',name:'Pena Gel Hitam 0.5 mm',variant:'Hitam',baseUnit:'buah',units:{buah:1,kotak:12},fractional:false,active:true}
  ];
  const remap=new Map(baseConfig.products.map((p,i)=>[p.id,config.products[i]?.id]));
  config.demo.openingStock=baseConfig.demo.openingStock.map(l=>({...l,productId:remap.get(l.productId)??l.productId}));
  config.demo.prices=config.products.map((p,i)=>({productId:p.id,amount:retail?[125000,65000][i]:[55000,8000][i]}));
 }
 validateInstallation({...config,preset});
 const businessId=config.business.id;const warehouseId=config.locations.find(l=>l.active&&l.kind==='warehouse')?.id??config.locations[0].id;const outlets=config.locations.filter(l=>l.active&&l.kind==='outlet');const outletA=outlets[0]?.id??warehouseId,outletB=outlets[1]?.id??outletA;
 const users: User[]=demo ? personas.map(id=>({id,businessId,name:({owner:'Pengelola',inventory:'Petugas gudang',receiver:'Penerima Garut 1',cashier:'Kasir Garut 1',pricing:'Pengelola harga',auditor:'Pemeriksa',mixed:'Budi · Kasir A / Harga B'})[id],active:true,assignments:id==='mixed'?[{role:'cashier',locationIds:[outletA]},{role:'pricing',locationIds:[outletB]}]:[{role:id as Role,locationIds:id==='owner'||id==='pricing'||id==='auditor'?['*']:id==='inventory'?[warehouseId]:[outletA]}]})) : [{id:'owner',businessId,name:'Administrator',active:true,assignments:[{role:'owner',locationIds:['*']}]}];
 const state: OperationsState={schemaVersion:1,businessId,businessName:config.business.name,timezone:config.business.timezone,demo,preset:demo?preset:config.preset,modules:{...config.modules},revision:0,updatedAt:now,locations:structuredClone(config.locations) as Location[],products:structuredClone(config.products) as Product[],users,transfers:[],mutations:[],documents:[],audit:[],prices:[],promotions:[],profiles:[],sales:[],payments:[],returns:[],shifts:[],cashEntries:[],counts:[]};
 if(demo){
 state.prices=config.demo.prices.map((p,i)=>({id:`seed-price-${i}`,productId:p.productId,amount:p.amount,locationId:'*',startsAt:'2000-01-01T00:00:00.000Z'}));
 for(const [i,line] of config.demo.openingStock.entries()){const id=`seed-opening-${i}`,pr=state.products.find(p=>p.id===line.productId)!;state.mutations.push({id:`${id}-mutation`,documentId:id,commandId:id,locationId:line.locationId,productId:line.productId,condition:line.condition as 'sellable',quantity:line.quantity,unit:pr.baseUnit,factor:1,actorId:'owner',occurredAt:now,recordedAt:now,reason:'Demo opening stock'});state.documents.push({id,type:'stock.open',actorId:'owner',locationIds:[line.locationId],occurredAt:now,recordedAt:now,reason:'Demo opening stock',data:{source:'demo-seed',proof:'operations.json',lines:[line]}});state.audit.push({id:`${id}-audit`,actorId:'owner',type:'stock.open',documentId:id,locationIds:[line.locationId],recordedAt:now,reason:'Demo opening stock'});}
 }
 return state;
}
