// css & css modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
// scss & scss modules
declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}
