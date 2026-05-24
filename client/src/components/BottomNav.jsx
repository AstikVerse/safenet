import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Map, User } from 'lucide-react';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      label: 'Home',
      icon: Home,
      path: '/home'
    },
    {
      label: 'Map',
      icon: Map,
      path: '/map'
    },
    {
      label: 'Profile',
      icon: User,
      path: '/profile'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-border-soft px-6 py-3 flex justify-around items-center z-50 shadow-lg rounded-t-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center justify-center gap-1 interactive-transition"
            style={{ width: '60px' }}
          >
            <div
              className={`p-2 rounded-full interactive-transition ${
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-dark-muted hover:text-dark-body hover:bg-background-warm'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span
              className={`text-[11px] font-semibold tracking-wider interactive-transition ${
                isActive ? 'text-primary' : 'text-dark-muted'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
