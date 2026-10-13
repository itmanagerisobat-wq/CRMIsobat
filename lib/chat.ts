export type ChatScope = 'b2b' | 'b2c' | 'all';
export const ROOM_IDS = ['general', 'b2c'];

export function dmChannel(a: string, b: string): string {
  return 'dm:' + [a, b].sort().join('|');
}
export function roomsForScope(scope: ChatScope): string[] {
  return scope === 'all' ? ['general', 'b2c'] : scope === 'b2c' ? ['b2c'] : ['general'];
}
export function scopesCanSee(me: ChatScope, other: ChatScope): boolean {
  return me === 'all' || other === 'all' || me === other;
}
export function channelVisibleTo(channel: string, userId: string, scope: ChatScope): boolean {
  if (ROOM_IDS.includes(channel)) return roomsForScope(scope).includes(channel);
  if (!channel.startsWith('dm:')) return false;
  return channel.slice(3).split('|').includes(userId);
}
