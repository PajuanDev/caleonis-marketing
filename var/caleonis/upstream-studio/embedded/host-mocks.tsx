import React from 'react';
const api=(path:string,init?:RequestInit)=>fetch('/fixture-api'+path,init);
export const useFetch=()=>api;
export const useUser=()=>({orgId:'fixture-organization',role:'ADMIN'});
export default function Link({href,children,...rest}:React.AnchorHTMLAttributes<HTMLAnchorElement>){return <a href={href} {...rest}>{children}</a>;}
