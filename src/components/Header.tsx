import { User, Package } from 'lucide-react';

type ViewKey = 'browse' | 'profile' | 'mylistings' | 'rentals' | 'return';
type HeaderProps = {
  currentView: ViewKey;
  onNavigate: (view: ViewKey) => void;
};

export default function Header({ currentView, onNavigate }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Package className="w-8 h-8 text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-900">Gear Share</h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-semibold">
              UCF
            </span>
          </div>

          <nav className="flex space-x-6">
            <button
              onClick={() => onNavigate('browse')}
              className={`text-sm font-medium transition-colors ${
                currentView === 'browse'
                  ? 'text-emerald-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Browse Gear
            </button>
            <button
              onClick={() => onNavigate('mylistings')}
              className={`text-sm font-medium transition-colors ${
                currentView === 'mylistings'
                  ? 'text-emerald-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Listings
            </button>
            <button
              onClick={() => onNavigate('rentals')}
              className={`text-sm font-medium transition-colors ${
                currentView === 'rentals'
                  ? 'text-emerald-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Rentals
            </button>
          </nav>

          <button
            onClick={() => onNavigate('profile')}
            className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-sm font-medium">Profile</span>
          </button>
        </div>
      </div>
    </header>
  );
}
