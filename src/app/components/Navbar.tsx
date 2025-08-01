import Link from 'next/link';

const Navbar = () => {
  const links = [
    { label: 'What is it?', href: '/about' },
    { label: 'Where can I find it?', href: '/map' },
    { label: 'Past Issues', href: '/past-issues' },
    { label: 'Feature Me!', href: '/feature-me' },
    { label: 'Advertise', href: '/advertise' },
  ];

  return (
    <nav className="w-full px-6 py-4 flex justify-between items-center bg-[#AAEEFF] border-b-3 border-black z-50 relative">
      <Link href="/" className="text-xl font-bold hover:underline text-black">
        Zineground
      </Link>
      <ul className="flex items-center gap-24 text-xl font-normal text-black">
        {links.map(({ label, href }, idx) => (
          <li key={idx}>
            <Link href={href} className="hover:underline hover:text-black">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;
