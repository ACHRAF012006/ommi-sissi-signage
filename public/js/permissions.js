export const isStaffRole=role=>role==='admin'||role==='user';
export function permissionsFor(role) {
 const administrator=role==='admin';
 return {createStore:administrator,manageUsers:administrator,settings:administrator};
}
