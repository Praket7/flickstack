export interface ExpressionContext {
  frame:number; time:number; width:number; height:number; index:number; seed:number;
  vars:Record<string,number>;
}
export type ExpressionOpcode='const'|'load'|'neg'|'add'|'sub'|'mul'|'div'|'mod'|'pow'|'lt'|'lte'|'gt'|'gte'|'eq'|'neq'|'call';
export interface ExpressionInstruction { op:ExpressionOpcode; value?:number; name?:string; argc?:number }
export interface ExpressionProgramV1 { version:1; source:string; maxOperations:number; instructions:ExpressionInstruction[] }
export interface CompiledExpression extends ExpressionProgramV1 { evaluate(context:ExpressionContext):number }

type Token={type:'number'|'id'|'op'|'lparen'|'rparen'|'comma'|'eof';value:string};
type Ast={kind:'number';value:number}|{kind:'id';name:string}|{kind:'unary';op:string;value:Ast}|{kind:'binary';op:string;left:Ast;right:Ast}|{kind:'call';name:string;args:Ast[]};

const FORBIDDEN_NAMES=new Set(['process','globalThis','Date','Math','constructor','prototype','__proto__','require','fetch','eval','import','new','while','for','function','this','window','document','WebSocket','XMLHttpRequest']);
const FUNCTIONS=new Set(['sin','cos','tan','abs','min','max','clamp','lerp','floor','ceil','round','sqrt','pow','exp','log','noise','select']);
function forbiddenIdentifier(name:string):boolean { return name.split('.').some(p=>FORBIDDEN_NAMES.has(p)); }
function tokenize(source:string):Token[] {
  if(source.length>4096)throw new Error('expression source exceeds limit');
  if(/[\[\]{};`"']/u.test(source))throw new Error('forbidden expression syntax');
  const out:Token[]=[];let i=0;
  while(i<source.length){
    const c=source[i];if(/\s/u.test(c)){i++;continue;}
    if(/[0-9.]/u.test(c)){const m=source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u);if(!m)throw new Error(`unexpected token at ${i}`);out.push({type:'number',value:m[0]});i+=m[0].length;continue;}
    if(/[A-Za-z_]/u.test(c)){const m=source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_.]*/u)!;const name=m[0];if(forbiddenIdentifier(name))throw new Error(`forbidden identifier ${name}`);out.push({type:'id',value:name});i+=name.length;continue;}
    const two=source.slice(i,i+2);if(['<=','>=','==','!='].includes(two)){out.push({type:'op',value:two});i+=2;continue;}
    if('+-*/%^<>'.includes(c)){out.push({type:'op',value:c});i++;continue;}
    if(c==='=')throw new Error('forbidden assignment syntax');
    if(c==='('){out.push({type:'lparen',value:c});i++;continue;}if(c===')'){out.push({type:'rparen',value:c});i++;continue;}if(c===','){out.push({type:'comma',value:c});i++;continue;}
    throw new Error(`unexpected token ${c}`);
  }
  out.push({type:'eof',value:''});return out;
}
class Parser {
  private i=0;private readonly t:Token[];constructor(tokens:Token[]){this.t=tokens}
  private peek(){return this.t[this.i]} private take(){return this.t[this.i++]}
  parse():Ast{const a=this.comparison();if(this.peek().type!=='eof')throw new Error(`unexpected token ${this.peek().value}`);return a;}
  private comparison():Ast{let a=this.additive();while(this.peek().type==='op'&&['<','<=','>','>=','==','!='].includes(this.peek().value)){const op=this.take().value;a={kind:'binary',op,left:a,right:this.additive()};}return a;}
  private additive():Ast{let a=this.multiplicative();while(this.peek().type==='op'&&'+-'.includes(this.peek().value)){const op=this.take().value;a={kind:'binary',op,left:a,right:this.multiplicative()};}return a;}
  private multiplicative():Ast{let a=this.power();while(this.peek().type==='op'&&'*/%'.includes(this.peek().value)){const op=this.take().value;a={kind:'binary',op,left:a,right:this.power()};}return a;}
  private power():Ast{let a=this.unary();if(this.peek().type==='op'&&this.peek().value==='^'){this.take();a={kind:'binary',op:'^',left:a,right:this.power()};}return a;}
  private unary():Ast{if(this.peek().type==='op'&&'+-'.includes(this.peek().value)){const op=this.take().value;return{kind:'unary',op,value:this.unary()};}return this.primary();}
  private primary():Ast{
    const tok=this.take();if(tok.type==='number')return{kind:'number',value:Number(tok.value)};
    if(tok.type==='id'){
      if(this.peek().type==='lparen'){if(!FUNCTIONS.has(tok.value))throw new Error(`unknown function ${tok.value}`);this.take();const args:Ast[]=[];if(this.peek().type!=='rparen'){for(;;){args.push(this.comparison());if(this.peek().type==='comma'){this.take();continue;}break;}}if(this.take().type!=='rparen')throw new Error('unexpected expression; missing )');return{kind:'call',name:tok.value,args};}
      return{kind:'id',name:tok.value};
    }
    if(tok.type==='lparen'){const a=this.comparison();if(this.take().type!=='rparen')throw new Error('unexpected expression; missing )');return a;}
    throw new Error(`unexpected token ${tok.value}`);
  }
}
function compileAst(ast:Ast,out:ExpressionInstruction[]):void {
  switch(ast.kind){
    case 'number':out.push({op:'const',value:ast.value});return;
    case 'id':out.push({op:'load',name:ast.name});return;
    case 'unary':compileAst(ast.value,out);if(ast.op==='-')out.push({op:'neg'});return;
    case 'binary':compileAst(ast.left,out);compileAst(ast.right,out);out.push({op:({'+':'add','-':'sub','*':'mul','/':'div','%':'mod','^':'pow','<':'lt','<=':'lte','>':'gt','>=':'gte','==':'eq','!=':'neq'} as Record<string,ExpressionOpcode>)[ast.op]});return;
    case 'call':for(const a of ast.args)compileAst(a,out);out.push({op:'call',name:ast.name,argc:ast.args.length});return;
  }
}
function hashNoise(seed:number,a:number,b:number):number {const x=Math.sin((a*12.9898+b*78.233+seed*37.719))*43758.5453;return (x-Math.floor(x))*2-1;}
function load(name:string,ctx:ExpressionContext):number{const built:Record<string,number>={frame:ctx.frame,time:ctx.time,width:ctx.width,height:ctx.height,index:ctx.index,seed:ctx.seed,pi:Math.PI,e:Math.E};if(name in built)return built[name];if(name in ctx.vars)return ctx.vars[name];throw new Error(`unknown identifier ${name}`);}
function call(name:string,a:number[],ctx:ExpressionContext):number {switch(name){case'sin':return Math.sin(a[0]);case'cos':return Math.cos(a[0]);case'tan':return Math.tan(a[0]);case'abs':return Math.abs(a[0]);case'min':return Math.min(...a);case'max':return Math.max(...a);case'clamp':return Math.max(a[1],Math.min(a[2],a[0]));case'lerp':return a[0]+(a[1]-a[0])*a[2];case'floor':return Math.floor(a[0]);case'ceil':return Math.ceil(a[0]);case'round':return Math.round(a[0]);case'sqrt':return Math.sqrt(a[0]);case'pow':return Math.pow(a[0],a[1]);case'exp':return Math.exp(a[0]);case'log':return Math.log(a[0]);case'noise':return hashNoise(ctx.seed,a[0]??0,a[1]??0);case'select':return (a[0]??0)!==0?(a[1]??0):(a[2]??0);default:throw new Error(`unknown function ${name}`);}}
export function evaluateExpressionProgram(program:ExpressionProgramV1,context:ExpressionContext):number {
  if(program.version!==1)throw new Error(`unsupported expression bytecode version ${program.version}`);
  const stack:number[]=[];let budget=program.maxOperations;
  const pop=()=>{const v=stack.pop();if(v===undefined)throw new Error('invalid expression bytecode stack underflow');return v;};
  for(const ins of program.instructions){if(--budget<0)throw new Error('expression operation budget exceeded');
    switch(ins.op){case'const':stack.push(ins.value!);break;case'load':stack.push(load(ins.name!,context));break;case'neg':stack.push(-pop());break;
      case'add':{const b=pop(),a=pop();stack.push(a+b);break;}case'sub':{const b=pop(),a=pop();stack.push(a-b);break;}case'mul':{const b=pop(),a=pop();stack.push(a*b);break;}case'div':{const b=pop(),a=pop();if(b===0)throw new Error('division by zero');stack.push(a/b);break;}case'mod':{const b=pop(),a=pop();if(b===0)throw new Error('division by zero');stack.push(a%b);break;}case'pow':{const b=pop(),a=pop();stack.push(Math.pow(a,b));break;}
      case'lt':{const b=pop(),a=pop();stack.push(a<b?1:0);break;}case'lte':{const b=pop(),a=pop();stack.push(a<=b?1:0);break;}case'gt':{const b=pop(),a=pop();stack.push(a>b?1:0);break;}case'gte':{const b=pop(),a=pop();stack.push(a>=b?1:0);break;}case'eq':{const b=pop(),a=pop();stack.push(a===b?1:0);break;}case'neq':{const b=pop(),a=pop();stack.push(a!==b?1:0);break;}
      case'call':{const argc=ins.argc??0,args=Array.from({length:argc},()=>pop()).reverse();stack.push(call(ins.name!,args,context));break;}
    }
    const last=stack.at(-1);if(last!==undefined&&!Number.isFinite(last))throw new Error('expression produced non-finite result');
  }
  if(stack.length!==1)throw new Error('invalid expression bytecode stack result');return stack[0];
}
export function compileExpression(source:string,options:{maxOperations?:number}={}):CompiledExpression {
  const maxOperations=options.maxOperations??512;if(!Number.isInteger(maxOperations)||maxOperations<1||maxOperations>10_000)throw new Error('invalid expression operation budget');
  const ast=new Parser(tokenize(source)).parse();const instructions:ExpressionInstruction[]=[];compileAst(ast,instructions);
  const program:ExpressionProgramV1={version:1,source,maxOperations,instructions};return{...program,evaluate(context){return evaluateExpressionProgram(program,context);}};
}
export function evaluateExpression(source:string,context:ExpressionContext,options:{maxOperations?:number}={}):number{return compileExpression(source,options).evaluate(context);}
