'use client';
import SupabaseIntakeForm, { Field } from '../components/SupabaseIntakeForm';

// If you rename your table (recommended): use 'feature_me_interest' below.
// If not renamed yet, temporarily use 'feature-me_interest'.
const TABLE = 'feature-me_interest';

const fields: Field[] = [
  { name: 'name',         label: 'Your Name',  type: 'text',  required: true },
  { name: 'profession',   label: 'Profession', type: 'text',  required: true },
  { name: 'email',        label: 'Email',      type: 'email', required: true, pattern: /.+@.+\..+/ },
  { name: 'bio',          label: 'Short Bio',  type: 'textarea' },
  { name: 'website_link', label: 'Website Link', type: 'url', placeholder: 'https://' },
  { name: 'social_link',  label: 'Social Link',  type: 'url', placeholder: 'https://instagram.com/…' },
  { name: 'notes',        label: 'Notes',        type: 'textarea' },
];

export default function FeatureMePage() {
  return (
    <main className="min-h-screen bg-[#F0EBCC] text-black">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-4xl font-bold">Feature Me</h1>
          <p className="mt-2 text-lg">Artists, musicians, designers, writers—tell us what you’re making.</p>
        </header>

        <div className="rounded-3xl border border-black/20 bg-[#6F6F6F] p-6 text-white shadow-[6px_6px_0_#000]">
          <SupabaseIntakeForm
            table={TABLE}
            title="Get Featured"
            buttonLabel="Submit feature request"
            fields={fields}
          />
        </div>
      </section>
    </main>
  );
}
