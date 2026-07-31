'use client';

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: '5rem' }}>
      {children}
    </div>
  );
}
