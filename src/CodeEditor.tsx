import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    View,
    TextInput,
    ScrollView,
    StyleSheet,
    Platform,
    ColorValue,
    NativeSyntheticEvent,
    TextInputScrollEventData,
    TextInputKeyPressEventData,
    TextInputSelectionChangeEventData,
} from 'react-native';
import SyntaxHighlighter, {
    SyntaxHighlighterStyleType,
    SyntaxHighlighterSyntaxStyles,
} from './SyntaxHighlighter';
import { Languages } from './languages';
import * as Braces from './braces';
import * as Indentation from './indentation';
import * as Strings from './strings';

export type CodeEditorStyleType = SyntaxHighlighterStyleType & {
    /**
     * Editor height.
     */
    height?: string | number;

    /**
     * Editor width.
     */
    width?: string | number;

    /**
     * Editor top margin.
     */
    marginTop?: string | number;

    /**
     * Editor bottom margin.
     */
    marginBottom?: string | number;

    /**
     * Editor minimum height.
     */
    minHeight?: string | number;

    /**
     * Editor maximum height.
     */
    maxHeight?: string | number;

    /**
     * Use this property to align the text input with the syntax highlighter text.
     * @see highlighterLineHeight
     */
    inputLineHeight?: number;

    /**
     * Use this property to help you align the text input with the syntax highlighter text.
     * Do not use in production.
     * @see highlighterColor
     */
    inputColor?: ColorValue;
};

export const CodeEditorSyntaxStyles = SyntaxHighlighterSyntaxStyles;

type Props = {
    /**
     * Editor styles.
     */
    style?: CodeEditorStyleType;

    /**
     * Programming language to support.
     */
    language: Languages;

    /**
     * Syntax highlighting style.
     * @See https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_STYLES_HLJS.MD
     */
    syntaxStyle?: typeof CodeEditorSyntaxStyles;

    /**
     * Initial value on render.
     */
    initialValue?: string;

    /**
     * On value change.
     */
    onChange?: (newValue: string) => void;

    /**
     * On key press.
     */
    onKeyPress?: (key: string) => void;

    /**
     * Whether to show line numbers next to each line.
     */
    showLineNumbers?: boolean;

    /**
     * Make the editor read only.
     */
    readOnly?: boolean;

    /**
     * Focus the code editor on component mount.
     */
    autoFocus?: boolean;

    /**
     * Whether to enable auto-growth based on content
     */
    autoGrow?: boolean;

    /**
     * Test ID used for testing.
     */
    testID?: string;
};

type PropsWithForwardRef = Props & {
    forwardedRef: React.Ref<CodeEditorRef>;
};

type TextInputSelectionType = {
    start: number;
    end: number;
};

export type CodeEditorRef = Omit<TextInput, keyof React.Component> & {
    /**
     * Get the current code value
     */
    getValue: () => string;
};

const CodeEditor = (props: PropsWithForwardRef): JSX.Element => {
    const {
        style,
        language,
        syntaxStyle = CodeEditorSyntaxStyles.atomOneDark,
        initialValue = '',
        onChange,
        onKeyPress,
        showLineNumbers = false,
        readOnly = false,
        autoFocus = true,
        autoGrow = false,
        testID,
        forwardedRef,
    } = props;

    const {
        width = undefined,
        height = undefined,
        minHeight = undefined,
        maxHeight = undefined,
        marginTop = undefined,
        marginBottom = undefined,
        inputLineHeight = undefined,
        inputColor = 'rgba(0,0,0,0)',
        ...addedStyle
    } = style || {};

    const {
        fontFamily = Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace',
        fontSize = 16,
        padding = 16,
    } = addedStyle;

    const [value, setValue] = useState<string>(initialValue);
    const [contentHeight, setContentHeight] = useState<number>(0);
    const highlighterRef = useRef<ScrollView>(null);
    const inputRef = useRef<TextInput>(null);
    const inputSelection = useRef<TextInputSelectionType>({ start: 0, end: 0 });

    // Only when line numbers are showing
    const lineNumbersPadding = showLineNumbers ? 1.75 * fontSize : undefined;

    // Sync forwardedRef with inputRef and add getValue method
    useImperativeHandle<CodeEditorRef, CodeEditorRef>(
        forwardedRef,
        () => {
            const input = inputRef.current;
            if (!input) {
                throw new Error('Input ref is not initialized');
            }

            return {
                ...input,
                getValue: () => value,
                // Explicitly exclude React.Component methods
                setState: undefined as any,
                forceUpdate: undefined as any,
                render: undefined as any,
            };
        },
        [inputRef, value]
    );

    useEffect(() => {
        if (onChange) {
            onChange(value);
        }
    }, [onChange, value]);

    // Effect to ensure scroll position remains at the top
    useEffect(() => {
        // Reset scroll position to top when content changes
        highlighterRef.current?.scrollTo({ y: 0, animated: false });
        inputRef.current?.setNativeProps({ text: value });
    }, [value]);

    // Negative values move the cursor to the left
    const moveCursor = (current: number, amount: number) => {
        const newPosition = current + amount;
        inputRef.current?.setNativeProps({
            selection: {
                start: newPosition,
                end: newPosition,
            },
        });
        return newPosition;
    };

    const addIndentation = (val: string) => {
        let cursorPosition = inputSelection.current.start - 1;

        // All lines before the cursor
        const preLines = val.substring(0, cursorPosition).split('\n');
        const indentSize = Indentation.getSuggestedIndentSize(preLines);
        let indentation = Indentation.createIndentString(indentSize);

        // Add newline and indentation on a regular brace pair
        const leftChar = val[cursorPosition - 1] || '';
        const rightChar = val[cursorPosition + 1] || '';
        if (Braces.isBracePair(leftChar, rightChar)) {
            let addedIndentionSize = Braces.isRegularBrace(leftChar)
                ? Math.max(indentSize - Indentation.INDENT_SIZE, 0)
                : indentSize;
            indentation += '\n' + Indentation.createIndentString(addedIndentionSize);
            // Don't update local cursor position to insert all new changes in one insert call
            moveCursor(cursorPosition, -addedIndentionSize);
        }

        return Strings.insertStringAt(val, cursorPosition, indentation);
    };

    const addClosingBrace = (val: string, key: string) => {
        let cursorPosition = inputSelection.current.start;
        cursorPosition = moveCursor(cursorPosition, -1);
        return Strings.insertStringAt(val, cursorPosition, Braces.getCloseBrace(key));
    };

    const handleChangeText = (text: string) => {
        setValue(Strings.convertTabsToSpaces(text));
        // Ensure position stays at the top after text change
        highlighterRef.current?.scrollTo({ y: 0, animated: false });
    };

    const handleScroll = (e: NativeSyntheticEvent<TextInputScrollEventData>) => {
        // Match text input scroll with syntax highlighter scroll
        const y = e.nativeEvent.contentOffset.y;
        highlighterRef.current?.scrollTo({ y, animated: false });
    };

    const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        const key = e.nativeEvent.key;
        switch (key) {
            case 'Enter':
                setTimeout(() => {
                    setValue((curr) => addIndentation(curr));
                }, 10);
                break;
            default:
                if (Braces.isOpenBrace(key)) {
                    setTimeout(() => {
                        setValue((curr) => addClosingBrace(curr, key));
                    }, 10);
                }
                break;
        }
        if (onKeyPress) {
            onKeyPress(key);
        }
    };

    const handleSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        inputSelection.current = e.nativeEvent.selection;
    };

    const handleContentSizeChange = (e: { nativeEvent: { contentSize: { height: number } } }) => {
        if (autoGrow) {
            const newHeight = e.nativeEvent.contentSize.height;
            const maxHeightNum =
                typeof maxHeight === 'string' ? parseInt(maxHeight, 10) : maxHeight;
            const minHeightNum =
                typeof minHeight === 'string' ? parseInt(minHeight, 10) : minHeight;

            if (maxHeightNum && newHeight > maxHeightNum) {
                setContentHeight(maxHeightNum);
            } else if (minHeightNum && newHeight < minHeightNum) {
                setContentHeight(minHeightNum);
            } else {
                setContentHeight(newHeight);
            }
        }
    };

    const finalHeight = autoGrow ? contentHeight || height : height;

    return (
        <View
            style={{
                width,
                height: finalHeight,
                marginTop,
                marginBottom,
            }}
            testID={testID}
        >
            <SyntaxHighlighter
                language={language}
                addedStyle={addedStyle}
                syntaxStyle={syntaxStyle}
                scrollEnabled={false}
                showLineNumbers={showLineNumbers}
                testID={`${testID}-syntax-highlighter`}
                ref={highlighterRef}
            >
                {value}
            </SyntaxHighlighter>
            <TextInput
                style={[
                    styles.input,
                    {
                        lineHeight: inputLineHeight,
                        color: inputColor,
                        fontFamily: fontFamily,
                        fontSize: fontSize,
                        padding,
                        paddingTop: padding,
                        paddingLeft: lineNumbersPadding,
                        minHeight,
                        maxHeight,
                    },
                ]}
                value={value}
                onChangeText={handleChangeText}
                onScroll={handleScroll}
                onKeyPress={handleKeyPress}
                onSelectionChange={handleSelectionChange}
                onContentSizeChange={handleContentSizeChange}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                autoFocus={autoFocus}
                keyboardType="ascii-capable"
                editable={!readOnly}
                testID={`${testID}-text-input`}
                ref={inputRef}
                multiline
            />
        </View>
    );
};

const CodeEditorWithForwardRef = React.forwardRef<CodeEditorRef, Props>((props, ref) => (
    <CodeEditor {...props} forwardedRef={ref} />
));

export default CodeEditorWithForwardRef;

const styles = StyleSheet.create({
    input: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        textAlignVertical: 'top',
    },
});
