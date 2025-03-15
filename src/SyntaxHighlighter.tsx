import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { View, ScrollView, Text, Platform, ColorValue, TextStyle, findNodeHandle } from 'react-native';
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
     * Whether to preserve scroll position when content changes.
     * If true, won't reset scroll to top when content changes.
     */
    preserveScrollPosition?: boolean;

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
        preserveScrollPosition = false,
        forwardedRef,
        testID,
        ...highlighterProps
    } = props;

    // Track whether this is the initial render
    const isInitialRender = useRef(true);
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

    // More aggressive approach to ensure scroll is at top on initial render
    const forceScrollToTop = () => {
        if (!scrollViewRef.current || (preserveScrollPosition && !isInitialRender.current)) return;
        
        // Use multiple strategies to ensure we start at the top
        try {
            // Direct method
            scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
            
            // Try with a node handle if available (React Native specific)
            const nodeHandle = findNodeHandle(scrollViewRef.current);
            if (nodeHandle) {
                // Force a reset of the ScrollView's internal state
                scrollViewRef.current.setNativeProps({
                    contentOffset: { x: 0, y: 0 }
                });
            }
        } catch (err) {
            console.warn('Failed to force scroll to top:', err);
        }
        
        // Additional attempts with delays for reliability
        const timeouts = [0, 50, 150, 300, 500].map(delay => 
            setTimeout(() => {
                if (!scrollViewRef.current || 
                    (preserveScrollPosition && !isInitialRender.current)) return;
                
                try {
                    scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
                    scrollViewRef.current.setNativeProps({
                        contentOffset: { x: 0, y: 0 }
                    });
                } catch (err) {
                    // Ignore errors in timeouts
                }
            }, delay)
        );
        
        // Clean up timeouts
        return () => timeouts.forEach(clearTimeout);
    };
    
    // On mount and when dependenices change, force scroll to top
    useLayoutEffect(() => {
        const cleanupTimeouts = forceScrollToTop();
        
        // After all attempts, mark initial render as complete
        const finalTimeout = setTimeout(() => {
            isInitialRender.current = false;
        }, 600);
        
        return () => {
            if (cleanupTimeouts) cleanupTimeouts();
            clearTimeout(finalTimeout);
        };
    }, [preserveScrollPosition]);
    
    // Check if content has changed
    useEffect(() => {
        const newContentKey = `${highlighterProps.children}`;
        if (contentKey.current !== newContentKey) {
            contentKey.current = newContentKey;
            if (!preserveScrollPosition || isInitialRender.current) {
                forceScrollToTop();
            }
        }
    }, [highlighterProps.children, preserveScrollPosition]);

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
                    
                    // Immediately force scroll to top when ref is set if it's initial render
                    if (ref && (isInitialRender.current || !preserveScrollPosition)) {
                        try {
                            ref.scrollTo({ x: 0, y: 0, animated: false });
                            ref.setNativeProps({
                                contentOffset: { x: 0, y: 0 }
                            });
                        } catch (err) {
                            console.warn('Failed to set initial scroll position:', err);
                        }
                    }
                }}
                scrollEnabled={scrollEnabled}
                automaticallyAdjustContentInsets={false}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="always"
                overScrollMode="never"
                scrollEventThrottle={16}
                keyboardDismissMode="none"
                // Explicitly set initial scroll position to top
                contentOffset={{x: 0, y: 0}}
                // Prevent any auto-scrolling to cursor/focused element
                maintainVisibleContentPosition={{autoscrollToTopThreshold: 0, minIndexForVisible: 0}}
                automaticallyAdjustsScrollIndicatorInsets={false}
                // Disable all automatic scroll adjustments
                contentInsetAdjustmentBehavior="never"
                directionalLockEnabled={true}
                onContentSizeChange={() => {
                    if ((isInitialRender.current || !preserveScrollPosition) && scrollViewRef.current) {
                        try {
                            scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
                            scrollViewRef.current.setNativeProps({
                                contentOffset: { x: 0, y: 0 }
                            });
                        } catch (err) {
                            // Ignore errors in callbacks
                        }
                    }
                }}
                onLayout={() => {
                    if ((isInitialRender.current || !preserveScrollPosition) && scrollViewRef.current) {
                        try {
                            scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
                            scrollViewRef.current.setNativeProps({
                                contentOffset: { x: 0, y: 0 }
                            });
                        } catch (err) {
                            // Ignore errors in callbacks
                        }
                    }
                }}
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
