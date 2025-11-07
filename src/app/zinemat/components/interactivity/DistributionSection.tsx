"use client";

export type Distribution = {
  self_distribute: boolean;
  print_for_me: boolean;
};

export default function DistributionSection({
  value,
  onChange,
}: {
  value: Distribution;
  onChange: (next: Distribution) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Choose how you want to distribute your zine to readers and distributors.
      </p>

      {/* Self Distribute */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={value.self_distribute}
          onChange={(e) =>
            onChange({ ...value, self_distribute: e.target.checked })
          }
          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <div className="font-medium group-hover:text-blue-600 transition">
            Self distribute
          </div>
          <div className="text-sm text-gray-600">
            You print and fulfill your own zines whenever you get a distribution order.
          </div>
        </div>
      </label>

      {/* Print for Me (Recommended) */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={value.print_for_me}
          onChange={(e) =>
            onChange({ ...value, print_for_me: e.target.checked })
          }
          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <div className="font-medium group-hover:text-blue-600 transition">
            Distribute for me{" "}
            <span className="text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Recommended
            </span>
          </div>
          <div className="text-sm text-gray-600">
            Zineground will print and deliver any distributor&apos;s order of copies for your zine, 
            anywhere in the world where distributors are located, no exceptions. This helps us build 
            a worldwide distribution network.
          </div>
        </div>
      </label>

      {value.print_for_me && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          ✨ Your zine will be available for distributors to order in the Distributor Portal once published!
        </div>
      )}
    </div>
  );
}

