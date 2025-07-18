'use client';
import { useEffect, useRef } from 'react';

const quotes = [
  "Need to talk to an electrical engineer. hmu. yes, it will be dangerous and complicated",
  "Exude love",
  "If you’re ever sad, just remember the world is 4.543 billion years old and you somehow managed to exist at the same time as The Focusrite Scarlett 2i2",
  "being cool is a prison. do something a litle embarassing and vulnerable",
  "Youth were never more sawcie, yea never more savagely saucie … the ancient are scorned, the honourable are contemned, the magistrate is not dreaded",
  "viva daft punk, la monogamia, los amigos, la cafeina, y el cine",
  "When the power of love overcomes the love of power the world will know peace",
  "Every time i’m in the UK i feel a gaping hole in the culture made by the absolute absence of mexicans",
  "No weirdo loser dumb shit formed against us shall prosper",
  "If my name was Josh I’d always be saying stuff like Joshinitely and Joshed up",
  "The world has bigger problems than boys who kiss boys and girls who kiss girls",
  "Sex is cool but have you ever fucked the system?",
  "She tastes like heaven",
  "Yes, a white boy can be soulful",
  "I was never really insane, except on occasions where my heart was touched",
  "Every machine is a smoke machine if you operate it wrong enough",
  "does the process know we are trusting it?",
  "i heard they’re making a process you don’t have to trust. it’s just not out yet",
  "I am friends with DJs, fashion designers, Chinese girls, venture capitalists, farmers, midwest mountain people, schizophrenics, normies, NEETs, dark mages, elves, accelerationists, micro influencers, music producer",
  "Buy _______ Feed intern",
  "babe whats wrong you’ve hardly touched your potential",
  "will you love me anyway?",
  "Yes, I will love you anyway",
  "Feel free to talk to the plants “They understand”",
  "Everything changes beyond absolute recognition",
  "The soul can never be cut into pieces by any weapon, nor can it be burned by fire, nor moistened by water, nor withered by the wind",
  "can i get a forehead kiss",
  "The rumors are true. I lost the IDGAF war. I do give a fuck. I actually care very deeply about many things",
  "You cannot compete with me. i want you to win too",
  "Whatever purifies you is the correct road",
  "You want to learn blender so bad",
  "They don’t know: When I look arount this room I wonder what the chances were of us meeting. The odds I would encounter these people, these experiences, the love and joy and pain and loss and deep heartache. I wonder why things are the way they are. Fate? Coincidence? Does it even matter? No matter how or why I’ve found myself here, I am immeasurably grateful. I love these people. I love this world",
  "“There comes a time in your life when you focus on what you believe is right. Regardless of what everybody else is doing”",
  "My favorite gateway drug is vibe coding",
  "Ignore the ugly juggernaut of baseball card art for billionaires. Make art to find out and cultivate what is inside you, to amuse your friend and find your peers. To make little evolutionary bricks for humanity. There is still a vital underground. Get a record player & spin some discs. Make some music. Bang a gong. Get a little sketchbook going",
  "Fuck your job. Money is fake, society isn’t natural, and the sun is going to explode",
  "tell me every terrible thing you ever did, and watch me love you anyways",
  "The cold water does not get warmer if you jump late",
  "If I’ve learned anything from video games, it is that when you meet enemies, it means that you’re going in the right direction",
  "if anyone has any experience with anything or knows anything about something please let me know",
  "When the function got people in STEM fields just tipsy enough to infodrop",
  "Fundamental attribution error",
  "The forest was shirnking, but the trees kept voting for the Axe, for the Axe was clever and convinces the Trees that because his handle was made of wood, he was one of them",
  "Your life actually changes overnight. It just takes years to get to that night",
  "At one point chemicals became so complex that they started observing themselves",
  "experience more, live more, accomplish more",
];

export default function RollingQuotes() {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pos = 0;
    let animationFrame: number;

    const scroll = () => {
      if (innerRef.current && containerRef.current) {
        pos += 0.4; // adjust speed here

        innerRef.current.style.transform = `translateY(-${pos}px)`;

        // Reset position when halfway through
        if (innerRef.current.scrollHeight / 2 - pos <= 0) {
          pos = 0;
        }

        animationFrame = requestAnimationFrame(scroll);
      }
    };

    animationFrame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed left-0 top-0 h-full w-[440px] overflow-hidden pointer-events-none z-0"
    >
      <div
        ref={innerRef}
        className="flex flex-col text-gray-500 opacity-44 text-lg px-4 py-8 space-y-7 will-change-transform"
      >
        {[...quotes, ...quotes].map((quote, i) => (
          <p key={i} className="leading-snug">{quote}</p>
        ))}
      </div>
    </div>
  );
}