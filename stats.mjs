export function stats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b), n=sorted.length;
  const median = n%2 ? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2;
  return {current:values.at(-1),median,p95:sorted[Math.ceil(n*.95)-1],jitter:n>1?values.slice(1).reduce((sum,v,i)=>sum+Math.abs(v-values[i]),0)/(n-1):0,min:sorted[0],max:sorted.at(-1)};
}
