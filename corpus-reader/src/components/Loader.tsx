const Loader = ({ text }: { text: string }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{backgroundColor: 'inherit', color: 'inherit'}}>
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-opacity-50" style={{borderTopColor: 'currentColor'}}></div>
      <p className="mt-4 text-lg font-medium" style={{color: 'inherit'}}>{text}</p>
    </div>
  );
};


export default Loader;