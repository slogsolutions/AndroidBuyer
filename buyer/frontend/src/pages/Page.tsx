import React from 'react';
import { Link } from 'react-router-dom';
import { CarScene } from '../3d/src/scenes/CarScene';

export default function LandingPage() {
  return (
    <main className="h-[calc(100vh-4rem)] relative">
      <div className="absolute top-0 bottom-0 left-0 right-0">
        <CarScene />
      </div>
      <div className="flex flex-col items-start space-y-2 font-black text-8xl text-white absolute top-[calc(25vh)] left-10">
        <div className="z-10 inline-block px-3 bg-primary mt-2">Need</div>{' '}
        <div className="z-10 inline-block w-full max-w-md px-3 bg-primary ">
          parking?
        </div>
        <Link
          to="/search"
          className="z-10 flex items-center gap-2 px-3 py-2 text-xl font-medium text-black underline underline-offset-4 bg-primary"
        >
          Search now
        </Link>
        <div className="mt-6 flex gap-4"></div>
      </div>
    </main>
  );
}
