import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { View, ScrollView, Text, Platform, ColorValue, TextStyle } from 'react-native';
import Highlighter, { SyntaxHighlighterProps as HighlighterProps } from 'react-syntax-highlighter';
import * as HLJSSyntaxStyles from 'react-syntax-highlighter/dist/esm/styles/hljs';

type Node = {
    children?: Node[];
    properties?: {
        className: string[];
    };
    tagName?: string;
    type: string;
    value?: string;
};

type StyleSheet = {
    [key: string]: TextStyle & {
        background?: string;
    };
};

type RendererParams = {
    rows: Node[];
    stylesheet: StyleSheet;
};

export type SyntaxHighlighterStyleType = {
    /**
     * Default is Menlo-Regular (iOS) and Monospace (Android).
     */
    fontFamily?: string;

    /**
     * Default is 16.
     */
    fontSize?: number;

    /**
     * Override the syntax style background.
     */
    backgroundColor?: ColorValue;

    /**
     * Default is 16.
     */
    padding?: number;

    /**
     * Text color of the line numbers.
     */
    lineNumbersColor?: ColorValue;

    /**
     * Background color of the line numbers.
     */
    lineNumbersBackgroundColor?: ColorValue;

    /**
     * Use this property to align the syntax highlighter text with the text input.
     */
    highlighterLineHeight?: number;

    /**
     * Use this property to help you align the syntax highlighter text with the text input.
     * Do not use in production.
     */
    highlighterColor?: ColorValue;
};

export const SyntaxHighlighterSyntaxStyles = HLJSSyntaxStyles;

export type SyntaxHighlighterProps = HighlighterProps & {
    /**
     * Code to display.
     */
    children: string;

    /**
     * Syntax highlighting style.
     * @See https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_STYLES_HLJS.MD
     */
    syntaxStyle?: typeof SyntaxHighlighterSyntaxStyles;

    /**
     * Extra styling options for the syntax highlighter.
     */
    addedStyle?: SyntaxHighlighterStyleType;

    /**
     * Whether to allow scrolling on the syntax highlighter.
     */
    scrollEnabled?: boolean;

    /**
     * Test ID used for testing.
     */
    testID?: string;
};

type PropsWithForwardRef = SyntaxHighlighterProps & {
    forwardedRef: React.Ref<ScrollView>;
};

const SyntaxHighlighter = (props: PropsWithForwardRef): JSX.Element => {
    const {
        syntaxStyle = SyntaxHighlighterSyntaxStyles.atomOneDark,
        addedStyle,
        scrollEnabled = true,
        showLineNumbers = false,
        forwardedRef,
        testID,
        ...highlighterProps
    } = props;

    // Track if we need to force scroll to top
    const shouldScrollToTop = useRef(true);
    const scrollViewRef = useRef<ScrollView | null>(null);
    
    // Track when content has changed
    const contentKey = useRef(`${highlighterProps.children}`);
    
    // Store the forwarded ref internally
    useEffect(() => {
        if (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef) {
            scrollViewRef.current = forwardedRef.current;
        }
    }, [forwardedRef]);

    // Default values
    const {
        fontFamily = Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace',
        fontSize = 16,
        backgroundColor = undefined,
        padding = 16,
        lineNumbersColor = 'rgba(127, 127, 127, 0.9)',
        lineNumbersBackgroundColor = undefined,
        highlighterLineHeight = undefined,
        highlighterColor = undefined,
    } = addedStyle || {};

    // Only when line numbers are showing
    const lineNumbersPadding = showLineNumbers ? 1.75 * fontSize : undefined;
    const lineNumbersFontSize = 0.7 * fontSize;

    // Prevents the last line from clipping when scrolling
    highlighterProps.children += '\n\n';

    // Force scroll to top with multiple approaches
    const forceScrollToTop = () => {
        if (!scrollViewRef.current) return;
        
        // Immediate attempt
        scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
        
        // Follow-up attempts with increasing delays
        setTimeout(() => {
            scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
        }, 0);
        
        setTimeout(() => {
            scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
        }, 50);
        
        setTimeout(() => {
            scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
        }, 200);
    };
    
    // Check if content has changed, if so we need to force scroll to top
    useEffect(() => {
        const newContentKey = `${highlighterProps.children}`;
        if (contentKey.current !== newContentKey) {
            contentKey.current = newContentKey;
            shouldScrollToTop.current = true;
            forceScrollToTop();
        }
    }, [highlighterProps.children]);
    
    // On mount, force scroll to top
    useLayoutEffect(() => {
        shouldScrollToTop.current = true;
        forceScrollToTop();
    }, []);

    const cleanStyle = (style: TextStyle) => {
        const clean: TextStyle = {
            ...style,
            display: undefined,
        };
        return clean;
    };

    const stylesheet: StyleSheet = Object.fromEntries(
        Object.entries(syntaxStyle as StyleSheet).map(([className, style]) => [
            className,
            cleanStyle(style),
        ])
    );

    const renderLineNumbersBackground = () => (
        <View
            style={{
                position: 'absolute',
                top: -padding,
                left: 0,
                bottom: 0,
                width: lineNumbersPadding ? lineNumbersPadding - 5 : 0,
                backgroundColor: lineNumbersBackgroundColor,
            }}
        />
    );

    const renderNode = (nodes: Node[], key = '0') =>
        nodes.reduce<React.ReactNode[]>((acc, node, index) => {
            if (node.children) {
                const textElement = (
                    <Text
                        key={`${key}.${index}`}
                        style={[
                            {
                                color: highlighterColor || stylesheet.hljs.color,
                            },
                            ...(node.properties?.className || []).map((c) => stylesheet[c]),
                            {
                                lineHeight: highlighterLineHeight,
                                fontFamily,
                                fontSize,
                                paddingLeft: lineNumbersPadding ?? padding,
                            },
                        ]}
                    >
                        {renderNode(node.children, `${key}.${index}`)}
                    </Text>
                );

                const lineNumberElement =
                    key !== '0' || index >= nodes.length - 2 ? undefined : (
                        <Text
                            key={`$line.${index}`}
                            style={{
                                position: 'absolute',
                                top: 5,
                                bottom: 0,
                                paddingHorizontal: nodes.length - 2 < 100 ? 5 : 0,
                                textAlign: 'center',
                                color: lineNumbersColor,
                                fontFamily,
                                fontSize: lineNumbersFontSize,
                                width: lineNumbersPadding ? lineNumbersPadding - 5 : 0,
                            }}
                        >
                            {index + 1}
                        </Text>
                    );

                acc.push(
                    showLineNumbers && lineNumberElement ? (
                        <View key={`view.line.${index}`}>
                            {lineNumberElement}
                            {textElement}
                        </View>
                    ) : (
                        textElement
                    )
                );
            }

            if (node.value) {
                // To prevent an empty line after each string
                node.value = node.value.replace('\n', '');
                // To render blank lines at an equal font height
                node.value = node.value.length ? node.value : ' ';
                acc.push(node.value);
            }

            return acc;
        }, []);

    const nativeRenderer = ({ rows }: RendererParams) => {
        return (
            <ScrollView
                style={[
                    stylesheet.hljs,
                    {
                        width: '100%',
                        height: '100%',
                        backgroundColor: backgroundColor || stylesheet.hljs.background,
                        // Prevents YGValue error
                        padding: 0,
                        paddingTop: padding,
                        paddingRight: padding,
                        paddingBottom: padding,
                    },
                ]}
                testID={`${testID}-scroll-view`}
                ref={(ref) => {
                    // Store both in our local ref and in the forwarded ref
                    scrollViewRef.current = ref;
                    if (forwardedRef) {
                        if (typeof forwardedRef === 'function') {
                            forwardedRef(ref);
                        } else {
                            // @ts-ignore - we know this is safe
                            forwardedRef.current = ref;
                        }
                    }
                    
                    // Force scroll to top on ref set
                    if (ref && shouldScrollToTop.current) {
                        shouldScrollToTop.current = false;
                        ref.scrollTo({ x: 0, y: 0, animated: false });
                    }
                }}
                scrollEnabled={scrollEnabled}
                automaticallyAdjustContentInsets={false}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="always"
                overScrollMode="never"
                scrollEventThrottle={16}
                keyboardDismissMode="none"
                contentOffset={{ x: 0, y: 0 }}
                maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                automaticallyAdjustsScrollIndicatorInsets={false}
                contentInsetAdjustmentBehavior="never"
                directionalLockEnabled={true}
                onContentSizeChange={() => {
                    if (shouldScrollToTop.current) {
                        shouldScrollToTop.current = false;
                        forceScrollToTop();
                    }
                }}
                onLayout={forceScrollToTop}
            >
                {showLineNumbers && renderLineNumbersBackground()}
                {renderNode(rows)}
            </ScrollView>
        );
    };

    return (
        <Highlighter
            {...highlighterProps}
            customStyle={{
                padding: 0,
            }}
            CodeTag={View}
            PreTag={View}
            renderer={nativeRenderer}
            testID={testID}
            style={stylesheet}
        />
    );
};

const SyntaxHighlighterWithForwardRef = React.forwardRef<ScrollView, SyntaxHighlighterProps>(
    (props, ref) => <SyntaxHighlighter {...props} forwardedRef={ref} />
);

export default SyntaxHighlighterWithForwardRef;
