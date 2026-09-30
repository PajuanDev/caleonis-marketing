import React from 'react';
export function useUser(){return {orgId:'11111111-1111-4111-8111-111111111111',role:'ADMIN'};}
export function useFetch(){return (path:string,options?:RequestInit)=>fetch('/fixture'+path,options);}
export function useRouter(){return {push:(path:string)=>{window.location.href=path;}};}
export function Link({href,children,...props}:any){return <a href={href} {...props}>{children}</a>;}
export function Image({unoptimized,fill,sizes,...props}:any){return <img {...props}/>;}
