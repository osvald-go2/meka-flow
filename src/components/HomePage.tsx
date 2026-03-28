import React, { useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { motion } from 'motion/react';
import mekaLogo from '../../public/meka_first.svg';
import { DbProject } from '../types';

interface HomePageProps {
  projects: DbProject[];
  onOpenDirectory: () => void;
  onSwitchProject: (projectId: number) => void;
  onNewSession: () => void;
}

export function HomePage({ projects, onOpenDirectory, onSwitchProject, onNewSession }: HomePageProps) {
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  );

  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime()
  );
  const displayProjects = showAll ? sortedProjects : sortedProjects.slice(0, 5);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    panelRef.current.style.setProperty('--mouse-x', `${x}px`);
    panelRef.current.style.setProperty('--mouse-y', `${y}px`);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    setTransform(
      `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`
    );
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    if (panelRef.current) {
      panelRef.current.style.setProperty('--mouse-x', `-1000px`);
      panelRef.current.style.setProperty('--mouse-y', `-1000px`);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4 sm:p-8 z-20 relative perspective-[2000px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        ref={panelRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform,
          transition: 'transform 0.1s ease-out',
          transformStyle: 'preserve-3d'
        }}
        className="group relative w-full max-w-[480px] max-h-[85vh] bg-[#111111]/60 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex flex-col items-center p-10 overflow-hidden"
      >
        {/* Dynamic Mouse Glow */}
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{
            background: 'radial-gradient(600px circle at var(--mouse-x, -1000px) var(--mouse-y, -1000px), rgba(255,255,255,0.06), transparent 40%)'
          }}
        />

        {/* Content (lifted in 3D) */}
        <div className="relative z-10 w-full flex flex-col items-center" style={{ transform: 'translateZ(30px)' }}>
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-10">
            <img
              src={mekaLogo}
              className="w-16 h-16 mb-5 drop-shadow-lg opacity-90 hover:scale-105 transition-all duration-300"
              alt="Meka Flow"
            />
            <h1 className="text-lg font-medium text-white/90 tracking-wide">Meka Flow</h1>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-3 mb-10">
            <button
              onClick={onOpenDirectory}
              className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-900/20 border border-orange-500/50"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
          </div>

          {/* Workspaces */}
          <div className="w-full flex-1 min-h-0">
            <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3 px-1">
              Workspaces
            </h2>
            <div className="flex flex-col gap-1 overflow-y-auto scrollbar-on-hover max-h-[30vh]">
              {displayProjects.length === 0 ? (
                <div className="px-4 py-8 text-center text-white/20 text-sm">
                  No recent workspaces
                </div>
              ) : (
                displayProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onSwitchProject(project.id)}
                    className="group/btn w-full text-left bg-transparent hover:bg-white/[0.04] border border-transparent hover:border-white/[0.05] rounded-xl p-3 transition-all duration-200"
                  >
                    <div className="text-[13px] font-medium text-white/70 group-hover/btn:text-white/90 transition-colors truncate">
                      {project.name}
                    </div>
                    <div className="text-[11px] text-white/30 mt-1 font-mono group-hover/btn:text-white/50 transition-colors truncate">
                      {project.path.replace(/^\/Users\/[^/]+/, '~')}
                    </div>
                  </button>
                ))
              )}
            </div>
            {sortedProjects.length > 5 && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
                >
                  {showAll ? 'Show Less' : `Show More... (${sortedProjects.length - 5} more)`}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
