'use client';
import SupabaseIntakeForm, { Field } from '../components/SupabaseIntakeForm';

const fields: Field[] = [
  { name: 'location_name',     label: 'Location Name',    type: 'text',   required: true },
  { name: 'address',           label: 'Address',          type: 'text',   required: true },
  { name: 'contact_name',      label: 'Contact Name',     type: 'text' },
  { name: 'email',             label: 'Email',            type: 'email',  pattern: /.+@.+\..+/ },
  { name: 'phone',             label: 'Phone',            type: 'tel' },
  { name: 'copies_requesting', label: 'Copies Requesting', type: 'number', help: 'How many copies would you like to stock?' },
  { name: 'notes',             label: 'Notes',            type: 'textarea' },
];

export default function DistributePage() {
  return (
    <main className="min-h-screen bg-[#F0EBCC] text-black">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-4xl font-bold">Distribute</h1>
          <p className="mt-2 text-lg">Stock the zine at your shop, café, venue, or studio.</p>
        </header>

        <div className="rounded-3xl border border-black/20 bg-[#6F6F6F] p-6 text-white shadow-[6px_6px_0_#000]">
          <SupabaseIntakeForm
            table="distribute_interest"
            title="Become a Distributor"
            buttonLabel="Apply to stock the zine"
            fields={fields}
          />
        </div>
      </section>
    </main>
  );
}
