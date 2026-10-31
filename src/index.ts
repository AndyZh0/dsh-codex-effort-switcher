/**
 * Host marker for this plugin's bundle row.
 *
 * The browser half carries the whole feature; the Host needs only a resolvable
 * module for the row the bundle patch inserts, which is also what makes the
 * `dsh.client` declaration visible to the client module scan.
 * @returns nothing; the row exists for composition, not for Host behavior.
 */
export function apply(): void {}
