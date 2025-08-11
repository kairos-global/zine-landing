'use client';
import SupabaseIntakeForm, { Field } from '../components/SupabaseIntakeForm';

const fields: Field[] = [
  { name: 'business_name', label: 'Business Name', type: 'text', required: true },
  { name: 'contact_name',  label: 'Contact Name',  type: 'text', required: true },
  { name: 'email',         label: 'Email',         type: 'email', required: true, pattern: /.+@.+\..+/ },
  { name: 'phone',         label: 'Phone',         type: 'tel' },
  { name: 'website_link',  label: 'Website Link',  type: 'url', placeholder: 'https://' },
  { name: 'campaign_type', label: 'Campaign Type', type: 'select', required: true, options: [
      { label: 'Quarter Page', value: 'quarter' },
      { label: 'Half Page',    value: 'half' },
      { label: 'Full Page',    value: 'full' },
    ] },
  { name: 'notes',         label: 'Notes',         type: 'textarea', placeholder: 'Anything we should know?' },
];

export default function AdvertisePage() {
  return (
    <main className="min-h-screen bg-[#F0EBCC] text-black">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-4xl font-bold">Advertise</h1>
          <p className="mt-2 text-lg">Get your business, event, or release in front of our readers.</p>
        </header>

        <div className="rounded-3xl border border-black/20 bg-[#6F6F6F] p-6 text-white shadow-[6px_6px_0_#000]">
          <SupabaseIntakeForm
            table="advertise_interest"
            title="Advertise with Zineground"
            buttonLabel="Send my ad request"
            fields={fields}
          />
        </div>
      </section>
    </main>
  );
}
