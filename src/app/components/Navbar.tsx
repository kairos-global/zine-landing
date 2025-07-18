const Navbar = () => {
    const links = [
      'What is it?',
      'Where can I find it?',
      'Past Issues',
      'Feature Me!',
      'Distribute'
    ];
  
    return (
      <nav className="w-full px-6 py-4 flex justify-between items-center bg-[#AAEEFF] border-b-3 border-black z-10">
        <h1 className="text-lg font-bold">Kairos Global Zine</h1>
        <ul className="items-center flex gap-24 text-xl font-small">
          {links.map((link, idx) => (
            <li key={idx} className="cursor-pointer hover:underline hover:text-black">
              {link}
            </li>
          ))}
        </ul>
      </nav>
    );
  };
  
  export default Navbar;
  