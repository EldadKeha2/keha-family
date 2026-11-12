using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace KehaFamily {
  internal static class Program {
    internal const string Title = "בית משפחת קהא";
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string name, string title);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr handle);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr handle);
    [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr handle, int command);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SetCurrentProcessExplicitAppUserModelID(string id);
    [STAThread] static int Main(string[] args) {
      Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
      SetCurrentProcessExplicitAppUserModelID("com.eldadkeha.family");
      var smoke = args.Length == 2 && args[0] == "--smoke-test";
      using (var mutex = new Mutex(true, "Local\\KehaFamilyDesktop" + (smoke ? "Smoke" : ""), out var first)) {
        if (!first) { var handle = FindWindow(null, Title); if (IsIconic(handle)) ShowWindowAsync(handle, 9); SetForegroundWindow(handle); return 0; }
        var file = smoke ? Path.Combine(args[1], "window-state.json") : SavedWindow.DefaultFile;
        var app = new FamilyWindow(file, smoke);Application.Run(app);return app.ExitCode;
      }
    }
  }
  internal sealed class FamilyWindow : Form {
    readonly string stateFile;
    readonly bool smoke;
    readonly WebView2 web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(247, 243, 233) };
    readonly Panel loading = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(247, 243, 233) };
    readonly Label status = new Label { AutoSize = false, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, Text = "הבית שלנו מתחיל כאן", ForeColor = Color.FromArgb(90, 110, 72), Font = new Font("Segoe UI", 17), RightToLeft = RightToLeft.Yes };
    readonly Button retry = new Button { Text = "ניסיון נוסף", Width = 140, Height = 40, Visible = false };
    readonly ProgressBar progress = new ProgressBar { Style = ProgressBarStyle.Marquee, MarqueeAnimationSpeed = 35, Height = 5, Width = 210 };
    readonly MenuStrip menu = new MenuStrip { Visible = false };
    readonly System.Windows.Forms.Timer saveTimer = new System.Windows.Forms.Timer { Interval = 200 };
    readonly Stopwatch startup = Stopwatch.StartNew();
    readonly SavedWindow saved;
    bool loaded, closing, fullscreen, webFullscreen, fullscreenBeforeWeb, changingWindowMode;
    Rectangle normalBounds;
    bool maximizedBeforeFullscreen;
    long shownMs;
    internal int ExitCode;
    internal FamilyWindow(string file, bool test = false, bool skipBrowser = false) {
      stateFile = file;smoke = test;saved = SavedWindow.Read(file);normalBounds = saved.Bounds;maximizedBeforeFullscreen = saved.Maximized;
      Text = Program.Title;StartPosition = FormStartPosition.Manual;Bounds = normalBounds;BackColor = loading.BackColor;
      MinimumSize = new Size(Math.Min(760, Screen.PrimaryScreen.WorkingArea.Width), Math.Min(480, Screen.PrimaryScreen.WorkingArea.Height));
      Icon = new Icon(Assembly.GetExecutingAssembly().GetManifestResourceStream("KehaFamily.icon.ico"));
      var center = new TableLayoutPanel { ColumnCount = 1, RowCount = 4, Size = new Size(360, 270), BackColor = loading.BackColor };
      var logo = new PictureBox { Image = Image.FromStream(Assembly.GetExecutingAssembly().GetManifestResourceStream("KehaFamily.logo.png")), SizeMode = PictureBoxSizeMode.Zoom, Width = 120, Height = 120, Anchor = AnchorStyles.None };
      center.RowStyles.Add(new RowStyle(SizeType.Absolute, 140));center.RowStyles.Add(new RowStyle(SizeType.Absolute, 65));center.RowStyles.Add(new RowStyle(SizeType.Absolute, 20));center.RowStyles.Add(new RowStyle(SizeType.Absolute, 45));
      progress.Anchor = AnchorStyles.None;retry.Anchor = AnchorStyles.None;center.Controls.Add(logo);center.Controls.Add(status);center.Controls.Add(progress);center.Controls.Add(retry);loading.Controls.Add(center);
      loading.Resize += (sender, e) => center.Location = new Point((loading.ClientSize.Width - center.Width) / 2, (loading.ClientSize.Height - center.Height) / 2);
      Controls.Add(web);Controls.Add(loading);BuildMenu();Controls.Add(menu);MainMenuStrip = menu;loading.BringToFront();
      retry.Click += async (sender, e) => { retry.Visible = false;progress.Visible = true;status.Text = "פותחים את הבית שלנו…";if (web.CoreWebView2 != null) web.CoreWebView2.Navigate(Links.Home);else await InitializeBrowser(); };
      saveTimer.Tick += (sender, e) => { saveTimer.Stop();Persist(); };
      Move += (sender, e) => Remember();Resize += (sender, e) => Remember();
      FormClosing += (sender, e) => { closing = true;saveTimer.Stop();Persist(); };
      FormClosed += (sender, e) => { saveTimer.Dispose();web.Dispose(); };
      if (saved.Maximized) WindowState = FormWindowState.Maximized;
      if (saved.Fullscreen) SetFullscreen(true);
      Shown += async (sender, e) => { shownMs = startup.ElapsedMilliseconds;loaded = true;if (!skipBrowser) await InitializeBrowser(); };
    }
    void BuildMenu() {
      var app = new ToolStripMenuItem(Program.Title);
      app.DropDownItems.Add("הבית / Home", null, (sender, e) => web.CoreWebView2?.Navigate(Links.Home));
      app.DropDownItems.Add("רענון / Reload", null, (sender, e) => { if (web.CoreWebView2 != null) web.Reload(); });
      app.DropDownItems.Add("הגדלת החלון / Maximize", null, (sender, e) => { SetFullscreen(false);WindowState = FormWindowState.Maximized; });
      app.DropDownItems.Add("מסך מלא / Full screen", null, (sender, e) => SetFullscreen(!fullscreen));
      app.DropDownItems.Add("פתיחה בדפדפן / Open in browser", null, (sender, e) => OpenExternal(Links.Home));
      app.DropDownItems.Add("סגירה / Quit", null, (sender, e) => Close());menu.Items.Add(app);
    }
    void Remember() {
      if (!loaded || fullscreen || changingWindowMode || WindowState == FormWindowState.Minimized) return;
      if (WindowState == FormWindowState.Normal) normalBounds = Bounds;
      maximizedBeforeFullscreen = WindowState == FormWindowState.Maximized;saveTimer.Stop();saveTimer.Start();
    }
    internal void SetFullscreen(bool value) {
      if (value == fullscreen) return;
      changingWindowMode = true;
      if (value) {
        if (loaded) { maximizedBeforeFullscreen = WindowState == FormWindowState.Maximized;if (WindowState == FormWindowState.Normal) normalBounds = Bounds; }
        fullscreen = true;WindowState = FormWindowState.Normal;FormBorderStyle = FormBorderStyle.None;Bounds = Screen.FromControl(this).Bounds;menu.Visible = false;
      } else {
        fullscreen = false;FormBorderStyle = FormBorderStyle.Sizable;Bounds = normalBounds;WindowState = maximizedBeforeFullscreen ? FormWindowState.Maximized : FormWindowState.Normal;
      }
      changingWindowMode = false;
      if (loaded) { saveTimer.Stop();saveTimer.Start(); }
    }
    internal void Persist() {
      try { new SavedWindow { Bounds = normalBounds, Maximized = maximizedBeforeFullscreen, Fullscreen = fullscreen }.Write(stateFile); } catch { }
    }
    protected override bool ProcessCmdKey(ref Message msg, Keys keyData) {
      if (keyData == Keys.F11) { SetFullscreen(!fullscreen);return true; }
      if (keyData == Keys.F10 || keyData == Keys.Menu) { menu.Visible = !menu.Visible;return true; }
      if (keyData == (Keys.Control | Keys.R)) { if (web.CoreWebView2 != null) web.Reload();return true; }
      return base.ProcessCmdKey(ref msg, keyData);
    }
    void OpenExternal(string value) { if (Links.External(value)) try { Process.Start(new ProcessStartInfo(value) { UseShellExecute = true }); } catch { } }
    async Task InitializeBrowser() {
      try {
        var userData = smoke ? Path.Combine(Path.GetDirectoryName(stateFile), "webview") : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KehaFamily", "WebView2");
        var environment = await CoreWebView2Environment.CreateAsync(null, userData);
        if (closing) return;
        await web.EnsureCoreWebView2Async(environment);if (closing) return;
        var core = web.CoreWebView2;core.Settings.AreHostObjectsAllowed = false;core.Settings.IsWebMessageEnabled = false;core.Settings.UserAgent += " KehaFamilyDesktop/2.0.0";
        core.NavigationStarting += (sender, e) => { if (!Links.Trusted(e.Uri) && !(smoke && e.Uri == "about:blank")) { e.Cancel = true;OpenExternal(e.Uri); } };
        core.NewWindowRequested += (sender, e) => { e.Handled = true;OpenExternal(e.Uri); };
        core.PermissionRequested += (sender, e) => e.State = CoreWebView2PermissionState.Deny;
        core.DOMContentLoaded += (sender, e) => { if (Links.Trusted(core.Source) || smoke) loading.Visible = false; };
        core.NavigationCompleted += (sender, e) => { if (!e.IsSuccess && e.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled) ShowError("לא הצלחנו להתחבר. בדקו את החיבור לאינטרנט ונסו שוב."); };
        core.ContainsFullScreenElementChanged += (sender, e) => { if (core.ContainsFullScreenElement) { fullscreenBeforeWeb = fullscreen;webFullscreen = true;SetFullscreen(true); } else if (webFullscreen) { webFullscreen = false;SetFullscreen(fullscreenBeforeWeb); } };
        web.KeyDown += (sender, e) => {
          if (e.KeyCode == Keys.F11) { e.Handled = true;e.SuppressKeyPress = true;SetFullscreen(!fullscreen); }
          if (e.KeyCode == Keys.F10) { e.Handled = true;e.SuppressKeyPress = true;menu.Visible = !menu.Visible; }
        };
        if (smoke) await VerifyNativeWindow(); else core.Navigate(Links.Home);
      } catch (Exception error) {
        if (closing) return;
        if (smoke) { File.WriteAllText(Path.Combine(Path.GetDirectoryName(stateFile), "failure.txt"), error.ToString());ExitCode = 1;Close();return; }
        ShowError(error is WebView2RuntimeNotFoundException ? "נדרש רכיב Microsoft WebView2. הפעילו שוב את המתקין להשלמתו." : "הפתיחה לא הושלמה. נסו שוב או פתחו את האתר בדפדפן.");
      }
    }
    void ShowError(string message) { if (closing) return;status.Text = message;status.Font = new Font("Segoe UI", 12);progress.Visible = false;retry.Visible = true;loading.Visible = true;loading.BringToFront(); }
    static void Check(bool result, string message) { if (!result) throw new InvalidOperationException(message); }
    async Task VerifyNativeWindow() {
      var area = Screen.PrimaryScreen.WorkingArea;
      Check(WindowState == FormWindowState.Maximized, "First launch must be maximized");
      Check(shownMs < 5000, "Window took too long to appear");
      Check(!web.CoreWebView2.Settings.AreHostObjectsAllowed && !web.CoreWebView2.Settings.IsWebMessageEnabled, "Native access must stay disabled");
      Check(!Links.Trusted("https://keha-family.eldadkeha.workers.dev.evil.test") && !Links.External("file:///C:/Windows") && !Links.External("javascript:alert(1)"), "Unsafe destination accepted");
      var gone = SavedWindow.Fit(new Rectangle(90000, 90000, 4000, 3000), new[] { area });Check(area.Contains(gone), "Disconnected monitor was not corrected");
      web.CoreWebView2.NavigateToString("<!doctype html><html><body><h1>Keha Family native verification</h1></body></html>");
      for (var i = 0; i < 100; i++) { await Task.Delay(50);if ((await web.ExecuteScriptAsync("document.body && document.body.textContent")).Contains("native verification")) break; }
      Check((await web.ExecuteScriptAsync("document.body.textContent")).Contains("native verification"), "WebView2 did not render");
      SetFullscreen(true);Persist();var full = SavedWindow.Read(stateFile);Check(full.Fullscreen && full.Maximized, "Fullscreen state was not persisted");
      using (var restored = new FamilyWindow(stateFile, true, true)) { restored.Show();await Task.Delay(150);Check(restored.fullscreen && restored.FormBorderStyle == FormBorderStyle.None, "Fullscreen was not restored");restored.SetFullscreen(false);Check(restored.WindowState == FormWindowState.Maximized, "Previous maximized state was lost");restored.Close(); }
      SetFullscreen(false);WindowState = FormWindowState.Normal;Bounds = new Rectangle(area.X + 30, area.Y + 30, Math.Min(1000, area.Width - 60), Math.Min(700, area.Height - 60));Remember();Persist();
      var normal = SavedWindow.Read(stateFile);Check(!normal.Maximized && !normal.Fullscreen && normal.Bounds.Width == Bounds.Width, "Normal bounds were not restored");
      File.WriteAllText(Path.Combine(Path.GetDirectoryName(stateFile), "result.json"), SavedWindow.Json.Serialize(new { shownMs, browserReadyMs = startup.ElapsedMilliseconds, maximized = true, fullscreenRestored = true, normalRestored = true, webViewRendered = true, safeNavigation = true }));
      ExitCode = 0;Close();
    }
  }
}
