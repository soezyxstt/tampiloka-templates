"""Verify local demo ordering with isolated test entities; never resets seeded data.
Run the local app with CAFE_DEMO_DB=1, then: python scripts/check-order-workflow.py
"""
import urllib.request,urllib.error,json,time
BASE='http://127.0.0.1:3000/api/v1/snapshot'
checks=[]
def command(name,payload,expected=200):
 req=urllib.request.Request(BASE,headers={'Content-Type':'application/json'},data=json.dumps({'command':name,'payload':payload}).encode())
 try:
  with urllib.request.urlopen(req,timeout=60) as r:status=r.status;data=json.load(r)
 except urllib.error.HTTPError as e:status=e.code;data=json.load(e)
 assert status==expected,(name,status,data.get('error'))
 return data.get('data',data)
with urllib.request.urlopen(BASE, timeout=60) as response:
 snapshot = json.load(response)['data']
assert snapshot.get('paymentAccount', {}).get('isDemo'), 'Run only against the local demo payment environment.'
# Assistance before a first order must not attach the guest to another table's visit.
emptyTables = [t for t in snapshot['tables'] if t['active'] and t['physicalState'] != 'OUT_OF_SERVICE' and not any(v['status'] == 'OPEN' and v.get('primaryTableId') == t['id'] for v in snapshot['visits'])]
if emptyTables:
 table = emptyTables[0]
 helpPayload = {'action':'CREATE','tableLabel':table['label'],'customerName':'Uji Bantuan Lokal','type':'CALL_WAITER','notes':'Integration verification'}
 helpResult = command('SERVICE_REQUEST_ACTION', helpPayload)['result']
 request = helpResult['serviceRequest']
 assert request['visitId'] is None and request['participantId'] is None and request['tableLabel'] == table['label']
 duplicateHelp = command('SERVICE_REQUEST_ACTION', helpPayload)['result']
 assert duplicateHelp['deduplicated'] and duplicateHelp['serviceRequest']['id'] == request['id']
 checks.append('pre-order assistance routes to selected table without fake visit and deduplicates')
 command('SERVICE_REQUEST_ACTION', {'action':'ACKNOWLEDGE','requestId':request['id'],'actorName':'Integration tester'})
 resolved = command('SERVICE_REQUEST_ACTION', {'action':'RESOLVE','requestId':request['id'],'actorName':'Integration tester','resolutionNote':'Local integration test completed'})
 assert resolved['result']['state'] == 'RESOLVED'
 checks.append('staff acknowledges and resolves pre-order assistance')
 otherVisit = next((v for v in snapshot['visits'] if v['status'] == 'OPEN' and v.get('primaryTableId') and v['primaryTableId'] != table['id']), None)
 if otherVisit:
  command('SERVICE_REQUEST_ACTION', dict(helpPayload, visitId=otherVisit['id']), 422)
  checks.append('assistance rejects another tables visit')
principal='integration_'+str(int(time.time()))
cart={'principalId':principal,'mode':'TAKEAWAY','items':[{'menuItemId':'item_teh_melati','variantId':'var_teh_std','modifierOptionIds':[],'note':'Local integration verification','quantity':1}]}
bad=json.loads(json.dumps(cart));bad['items'][0]['quantity']=1.5
command('CREATE_QUOTE',bad,422);checks.append('fractional quantity rejected')
bad=json.loads(json.dumps(cart));bad['items'][0]['modifierOptionIds']=['modopt_gula_less']
command('CREATE_QUOTE',bad,422);checks.append('unrelated modifier rejected')
# A scanned table link validates its own table without pretending GPS was checked.
qrTable = next(t for t in snapshot['tables'] if t['active'] and t['physicalState'] != 'OUT_OF_SERVICE')
qrCart = dict(cart, mode='DINE_IN', tableId=qrTable['id'])
qrQuote = command('CREATE_QUOTE', qrCart)['result']
qrPayload = {'quoteId':qrQuote['quoteId'],'principalId':principal,'customerName':'Uji QR Meja','mode':'DINE_IN','tableId':qrTable['id'],'presenceVerified':False,'idempotencyKey':principal+'_qr'}
command('SUBMIT_ORDER_REQUEST', qrPayload, 422)
command('SUBMIT_ORDER_REQUEST', dict(qrPayload, tableQrToken='incorrect-table-token'), 422)
checks.append('missing or incorrect QR token cannot bypass location gate')
qrSubmission = command('SUBMIT_ORDER_REQUEST', dict(qrPayload, tableQrToken=qrTable['qrToken']))
qrResult = qrSubmission['result']
assert qrResult['state'] == 'REQUESTED'
qrRequest = next(r for r in qrSubmission['snapshot']['orderRequests'] if r['id'] == qrResult['orderRequestId'])
assert qrRequest['presenceVerified'] is False
command('REJECT_ORDER_REQUEST', {'orderRequestId':qrResult['orderRequestId'],'reason':'Uji QR meja selesai','actorName':'Integration tester'})
checks.append('matching table QR allows ordering without false GPS claim')

# A new guest at an occupied table must still be admitted by staff.
if snapshot['outlet'].get('autoAcceptParticipant'):
 activeVisits = [v for v in snapshot['visits'] if v['status'] == 'OPEN' and v.get('primaryTableId') and any(p['visitId'] == v['id'] and p['status'] == 'ACTIVE' for p in snapshot['participants'])]
 if activeVisits:
  tableId = activeVisits[0]['primaryTableId']
  dineCart = dict(cart, mode='DINE_IN', tableId=tableId)
  dineQuote = command('CREATE_QUOTE', dineCart)['result']
  dine = command('SUBMIT_ORDER_REQUEST', {'quoteId':dineQuote['quoteId'],'principalId':principal,'customerName':'Uji Tamu Baru','mode':'DINE_IN','tableId':tableId,'presenceVerified':True,'idempotencyKey':principal+'_admission'})['result']
  assert dine['state'] == 'REQUESTED'
  command('REJECT_ORDER_REQUEST', {'orderRequestId':dine['orderRequestId'],'reason':'Uji penerimaan peserta selesai','actorName':'Integration tester','actorRole':'MANAGER'})
  checks.append('unadmitted guest is not auto-accepted into occupied visit')
quote=command('CREATE_QUOTE',cart)['result']
submitted=command('SUBMIT_ORDER_REQUEST',{'quoteId':quote['quoteId'],'principalId':principal,'customerName':'Uji Alur Lokal','mode':'TAKEAWAY','presenceVerified':True,'idempotencyKey':principal})['result']
assert submitted['state']=='REQUESTED';checks.append('customer request queued for cashier')
accepted=command('ACCEPT_ORDER_REQUEST',{'orderRequestId':submitted['orderRequestId'],'actorName':'Integration tester','actorRole':'MANAGER','paymentPolicyOverride':'PREPAY'})
a=accepted['result'];billId=a['billId'];bill=next(x for x in accepted['snapshot']['bills'] if x['id']==billId)
unitIds=[x['id'] for x in bill['allocatedUnits']]
assert all(x['fulfillmentStatus']=='HELD_FOR_PAYMENT' for x in bill['allocatedUnits']);checks.append('cashier accepts with PREPAY kitchen hold')
command('TRANSITION_UNITS',{'unitIds':unitIds,'targetStatus':'PREPARING','actorName':'Integration tester','actorRole':'KITCHEN'},422);checks.append('kitchen blocked until payment')
payment=command('RECORD_PAYMENT',{'billId':billId,'method':'QRIS','amountIdr':bill['balanceIdr'],'actorName':'Integration tester','createExternalAttemptOnly':True})
attId=payment['result']['attemptId'];bill=next(x for x in payment['snapshot']['bills'] if x['id']==billId);att=next(x for x in bill['attempts'] if x['id']==attId)
assert att['status']=='PENDING' and att['instructionsJson']['isDemo'] and att['instructionsJson']['qrPayload'].startswith('cafe-demo://');checks.append('pending nonpayable demo QRIS created')
command('RECORD_PAYMENT',{'billId':billId,'method':'CASH','amountIdr':bill['balanceIdr'],'actorName':'Integration tester'},422);checks.append('duplicate tender blocked')
settled=command('SETTLE_OR_CANCEL_ATTEMPT',{'attemptId':attId,'action':'SETTLE','actorName':'Integration tester'})
bill=next(x for x in settled['snapshot']['bills'] if x['id']==billId)
assert bill['balanceIdr']==0 and bill['paymentState']=='SETTLED';assert all(x['fulfillmentStatus']=='QUEUED' for x in bill['allocatedUnits']);assert len(bill['receipts'])==1;checks.append('demo settlement updates receipt/bill and releases kitchen')
duplicate=command('SETTLE_OR_CANCEL_ATTEMPT',{'attemptId':attId,'action':'SETTLE','actorName':'Integration tester'})
assert duplicate['result']['duplicateIgnored'];bill=next(x for x in duplicate['snapshot']['bills'] if x['id']==billId);assert len(bill['receipts'])==1;checks.append('duplicate settlement idempotent')
command('SETTLE_OR_CANCEL_ATTEMPT',{'attemptId':attId,'action':'CANCEL','actorName':'Integration tester'},422);checks.append('settled attempt cannot be cancelled')
for status in ['PREPARING','READY','PICKED_UP']:
 command('TRANSITION_UNITS',{'unitIds':unitIds,'targetStatus':status,'actorName':'Integration tester','actorRole':'KITCHEN'})
checks.append('kitchen preparation to pickup succeeds')
print(json.dumps({'passed':len(checks),'checks':checks,'localOrderId':a['orderId'],'localBillId':billId,'mode':'local demo only'},indent=2))
