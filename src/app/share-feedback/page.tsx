const ShareFeedbackPage = () => {
  return (
    <div className="p-6 min-h-screen flex flex-col items-center justify-start">
      <h1 className="text-3xl font-bold mb-6 text-center">Share Feedback</h1>
      <p>We&apos;d love to hear your thoughts about ZineGround and how we can improve.</p>
      <div className="w-full max-w-3xl aspect-[4/5]">
        <iframe
          src="https://form.typeform.com/to/RtHpU3yA"
          className="w-full h-full rounded-xl border-2 border-black shadow-md"
          title="Zine Feedback Form"
          allow="camera; microphone; autoplay; encrypted-media;"
        ></iframe>
      </div>
    </div>
  );
};

export default ShareFeedbackPage;
