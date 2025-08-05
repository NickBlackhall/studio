// src/app/not-found.tsx
export default function NotFound() {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white text-center">
        <h1 className="text-4xl font-bold mb-4">Oops!</h1>
        <p className="text-lg">The page you're looking for doesn’t exist.</p>
      </div>
    );
  }