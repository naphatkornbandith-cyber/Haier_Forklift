// js/supabase-client.js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
async function getAllForklifts() {
  const { data, error } = await supabase
    .from('forklifts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching data:', error);
    return [];
  }
  return data;
}
async function addForklift(item) {
  const { data, error } = await supabase
    .from('forklifts')
    .insert([{
      id: item.id || ('FL-' + Date.now().toString().slice(-4)),
      plate_number: item.plateNumber,
      vehicle_type: item.vehicleType,
      energy_type: item.energyType,
      lifting_capacity: item.liftingCapacity,
      owner_company: item.ownerCompany,
      subcontractor: item.subcontractor,
      is_subcontractor: item.isSubcontractor,
      registration_date: item.registrationDate,
      last_inspection_date: item.lastInspectionDate,
      status: item.status,
      photos: item.photos,
      checklist: item.checklist,
      driver: item.driver,
      notes: item.notes
    }]);

  if (error) throw new Error(error.message);
  return data;
}
async function updateForklift(id, updateFields) {
  const { data, error } = await supabase
    .from('forklifts')
    .update(updateFields)
    .eq('id', id);

  if (error) throw new Error(error.message);
  return data;
}
async function deleteForklift(id) {
  const { error } = await supabase
    .from('forklifts')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}