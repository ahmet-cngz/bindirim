import { trTR } from "@mui/material/locale";
import { createTheme } from "@mui/material/styles";
import tokens from "./tokens.module.scss";

export const theme = createTheme(
  {
    spacing: 8,
    shape: { borderRadius: 8 },
    palette: {
      mode: "dark",
      primary: {
        main: tokens.green,
        light: tokens.tint,
        dark: tokens.green,
        contrastText: tokens.canvas,
      },
      secondary: {
        main: tokens.blue,
        light: tokens.tint,
        dark: tokens.blue,
        contrastText: tokens.ink,
      },
      success: {
        main: tokens.green,
        light: tokens.tint,
        dark: tokens.blue,
        contrastText: tokens.paper,
      },
      warning: {
        main: tokens.green,
        light: tokens.tint,
        dark: tokens.blue,
        contrastText: tokens.canvas,
      },
      error: {
        main: tokens.ink,
        light: tokens.canvas,
        dark: tokens.ink,
        contrastText: tokens.paper,
      },
      info: {
        main: tokens.green,
        light: tokens.tint,
        dark: tokens.blue,
        contrastText: tokens.paper,
      },
      background: { default: tokens.canvas, paper: tokens.paper },
      text: {
        primary: tokens.ink,
        secondary: tokens.muted,
        disabled: tokens.muted,
      },
      divider: tokens.line,
      action: {
        active: tokens.green,
        disabled: tokens.muted,
        disabledBackground: tokens.line,
        hover: tokens.canvas,
        selected: tokens.tint,
        focus: tokens.tint,
      },
    },
    typography: {
      fontFamily: '"Manrope", "Segoe UI", sans-serif',
      h1: {
        fontSize: "2.5rem",
        fontWeight: 700,
        letterSpacing: "-.055em",
        lineHeight: 1.2,
      },
      h2: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.035em" },
      h3: { fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-.025em" },
      h4: { fontSize: "1rem", fontWeight: 700 },
      body1: { fontSize: ".9375rem", lineHeight: 1.7 },
      body2: { fontSize: ".8125rem", lineHeight: 1.7 },
      button: { fontSize: ".875rem", fontWeight: 600, textTransform: "none" },
      overline: {
        fontSize: ".625rem",
        letterSpacing: ".15em",
        fontWeight: 700,
      },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            padding: `${tokens.space8} ${tokens.space16}`,
            minHeight: 40,
            borderRadius: 8,
          },
          outlined: { borderColor: tokens.line, color: tokens.ink },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: "none" },
          outlined: { borderColor: tokens.line },
        },
      },
      MuiDialog: {
        defaultProps: { fullWidth: true, maxWidth: "sm" },
        styleOverrides: { paper: { borderRadius: 16, margin: tokens.space16 } },
      },
      MuiDialogTitle: { styleOverrides: { root: { padding: tokens.space24 } } },
      MuiDialogContent: {
        styleOverrides: { root: { padding: tokens.space24 } },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: tokens.space24, gap: tokens.space8 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { background: tokens.paper, borderRadius: 8 },
          notchedOutline: { borderColor: tokens.line },
          input: { padding: tokens.space16 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 600 },
          colorDefault: { background: tokens.canvas, color: tokens.muted },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            border: `1px solid ${tokens.line}`,
            borderRadius: 8,
            padding: `${tokens.space8} ${tokens.space16}`,
            background: tokens.canvas,
            color: tokens.ink,
            "&.MuiAlert-colorError": { color: tokens.ink },
            "&.MuiAlert-colorSuccess": { background: tokens.tint },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { background: tokens.ink, color: tokens.paper },
        },
      },
      MuiSkeleton: { styleOverrides: { root: { background: tokens.line } } },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            padding: `${tokens.space16} ${tokens.space24}`,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: tokens.line, padding: tokens.space16 },
        },
      },
      MuiCssBaseline: {
        styleOverrides: { body: { backgroundColor: tokens.canvas } },
      },
    },
  },
  trTR,
);
