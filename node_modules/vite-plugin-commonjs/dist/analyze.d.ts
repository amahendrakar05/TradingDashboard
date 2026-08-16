export declare enum TopScopeType {
    ExpressionStatement = "ExpressionStatement",
    VariableDeclaration = "VariableDeclaration"
}
export interface RequireStatement {
    /** CallExpression */
    node: AcornNode;
    ancestors: AcornNode[];
    /**
     * If require statement located top-level scope ant it is convertible, this will have a value(🎯-①)
     * 如果 require 在顶级作用于，并且是可转换 import 的，那么 topScopeNode 将会被赋值
     * @deprecated 🤔
     */
    topScopeNode?: AcornNode & {
        type: TopScopeType;
    };
    dynamic?: 'dynamic' | 'Literal';
}
export interface ExportsStatement {
    node: AcornNode;
    token: {
        left: string;
        right: string;
    };
}
export interface Analyzed {
    ast: AcornNode;
    code: string;
    id: string;
    require: RequireStatement[];
    exports: ExportsStatement[];
}
/**
 * `require` statement analyzer
 * require 语法分析器
 */
export declare function analyzer(ast: AcornNode, code: string, id: string): Analyzed;
