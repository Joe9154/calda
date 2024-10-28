import { createClient } from 'jsr:@supabase/supabase-js@2'

interface OrderInput {
  user_id: string;
  shipping_address: string;
  recipient_name: string;
  items: Array<{
    item_id: number;
    quantity: number;
  }>;
}

function createSupabaseClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )
}

async function calculateOrderTotals(supabase: any) {
  const { data, error } = await supabase
    .rpc('get_order_totals')
  if (error) throw error
  return data
}

// Insert new order and its items
async function insertOrder(supabase: any, orderData: OrderInput) {
  
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: orderData.user_id,
      shipping_address: orderData.shipping_address,
      recipient_name: orderData.recipient_name
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = orderData.items.map(item => ({
    order_id: order.id,
    item_id: item.item_id,
    quantity: item.quantity
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) throw itemsError;

  return order;
}

Deno.serve(async (_req) => {
  try {
    const supabase = createSupabaseClient(_req)
    const orderData: OrderInput = await _req.json()
    const order = await insertOrder(supabase, orderData)
    const totals = await calculateOrderTotals(supabase);
    return new Response(JSON.stringify({ totals }), { status: 200 })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})