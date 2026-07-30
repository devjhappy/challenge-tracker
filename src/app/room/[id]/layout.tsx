'use client';

export default function RoomLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  return (
    <div style={{ paddingBottom: '5rem' }}>
      {children}
    </div>
  );
}
