import { Calendar, Clock, Download, Play, Filter } from 'lucide-react';
import type { Camera } from '../App';

interface RecordingsPageProps {
  cameras: Camera[];
}

interface Recording {
  id: string;
  cameraId: string;
  cameraName: string;
  date: Date;
  duration: string;
  size: string;
  thumbnail: string;
}

const mockRecordings: Recording[] = [
  {
    id: 'rec-01',
    cameraId: 'cam-01',
    cameraName: 'Main Entrance',
    date: new Date(Date.now() - 2 * 60 * 60 * 1000),
    duration: '01:30:45',
    size: '2.4 GB',
    thumbnail: 'https://images.unsplash.com/photo-1762788204022-cbc5f242a6b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRyYW5jZSUyMGRvb3IlMjBzZWN1cml0eXxlbnwxfHx8fDE3NjQ5Mzk2ODl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: 'rec-02',
    cameraId: 'cam-02',
    cameraName: 'Parking Lot',
    date: new Date(Date.now() - 5 * 60 * 60 * 1000),
    duration: '02:15:20',
    size: '3.1 GB',
    thumbnail: 'https://images.unsplash.com/photo-1764684994222-739a69b1d61b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXJraW5nJTIwbG90JTIwc3VydmVpbGxhbmNlfGVufDF8fHx8MTc2NDkzOTY4NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: 'rec-03',
    cameraId: 'cam-03',
    cameraName: 'Office Floor 2',
    date: new Date(Date.now() - 8 * 60 * 60 * 1000),
    duration: '01:45:10',
    size: '2.7 GB',
    thumbnail: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjBidWlsZGluZyUyMGludGVyaW9yfGVufDF8fHx8MTc2NDkxMzY3NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: 'rec-04',
    cameraId: 'cam-04',
    cameraName: 'Warehouse',
    date: new Date(Date.now() - 12 * 60 * 60 * 1000),
    duration: '03:20:30',
    size: '4.2 GB',
    thumbnail: 'https://images.unsplash.com/photo-1610463076431-2717271d692d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXJlaG91c2UlMjBpbnRlcmlvcnxlbnwxfHx8fDE3NjQ5MjAwMDZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: 'rec-05',
    cameraId: 'cam-05',
    cameraName: 'Corridor East',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
    duration: '02:00:00',
    size: '3.0 GB',
    thumbnail: 'https://images.unsplash.com/photo-1660662735785-6e7c067d6cd0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3JyaWRvciUyMGhhbGx3YXklMjBpbnRlcmlvcnxlbnwxfHx8fDE3NjQ5Mzk2ODl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: 'rec-06',
    cameraId: 'cam-01',
    cameraName: 'Main Entrance',
    date: new Date(Date.now() - 48 * 60 * 60 * 1000),
    duration: '01:15:45',
    size: '2.1 GB',
    thumbnail: 'https://images.unsplash.com/photo-1762788204022-cbc5f242a6b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRyYW5jZSUyMGRvb3IlMjBzZWN1cml0eXxlbnwxfHx8fDE3NjQ5Mzk2ODl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
];

export function RecordingsPage({ cameras }: RecordingsPageProps) {
  return (
    <main className="flex-1 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white mb-1">Recorded Videos</h2>
          <p className="text-slate-400">Browse and download recorded footage</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Calendar className="w-4 h-4" />
            <span>Date Range</span>
          </button>
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Storage Info */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Total Storage</div>
          <div className="text-white">500 GB</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Used</div>
          <div className="text-white">342 GB</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Available</div>
          <div className="text-green-400">158 GB</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Recordings</div>
          <div className="text-white">{mockRecordings.length}</div>
        </div>
      </div>

      {/* Recordings Grid */}
      <div className="grid grid-cols-3 gap-4">
        {mockRecordings.map(recording => (
          <div
            key={recording.id}
            className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition-colors group"
          >
            {/* Thumbnail */}
            <div className="aspect-video bg-slate-950 relative overflow-hidden">
              <img
                src={recording.thumbnail}
                alt={recording.cameraName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button className="bg-blue-600 hover:bg-blue-700 p-4 rounded-full transition-colors">
                  <Play className="w-6 h-6 fill-current" />
                </button>
              </div>
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs">
                {recording.duration}
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="text-white mb-2">{recording.cameraName}</h3>
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{recording.date.toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{recording.date.toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <span>Size: {recording.size}</span>
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
