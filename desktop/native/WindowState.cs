using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace KehaFamily {
  internal sealed class SavedWindow {
    internal Rectangle Bounds;
    internal bool Maximized = true, Fullscreen;
    internal static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    internal static string DefaultFile => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "בית משפחת קהא", "window-state.json");
    internal static SavedWindow Read(string file) {
      var area = Screen.PrimaryScreen.WorkingArea;
      var state = new SavedWindow { Bounds = new Rectangle(area.X + 40, area.Y + 40, Math.Min(1200, area.Width), Math.Min(800, area.Height)) };
      try {
        var obj = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(file));
        var bounds = obj["bounds"] as Dictionary<string, object>;
        if (bounds != null) state.Bounds = new Rectangle(Convert.ToInt32(bounds["x"]), Convert.ToInt32(bounds["y"]), Convert.ToInt32(bounds["width"]), Convert.ToInt32(bounds["height"]));
        if (obj.TryGetValue("maximized", out var max) && max is bool) state.Maximized = (bool)max;
        if (obj.TryGetValue("fullscreen", out var full) && full is bool) state.Fullscreen = (bool)full;
      } catch { }
      state.Bounds = Fit(state.Bounds, Screen.AllScreens.Select(screen => screen.WorkingArea).ToArray());
      return state;
    }
    internal static Rectangle Fit(Rectangle old, Rectangle[] areas) {
      var area = areas.FirstOrDefault(item => { var overlap = Rectangle.Intersect(item, old); return overlap.Width >= 100 && overlap.Height >= 100; });
      if (area.IsEmpty) area = areas[0];
      var width = Math.Min(area.Width, Math.Max(Math.Min(760, area.Width), old.Width));
      var height = Math.Min(area.Height, Math.Max(Math.Min(480, area.Height), old.Height));
      return new Rectangle(Math.Max(area.Left, Math.Min(area.Right - width, old.X)), Math.Max(area.Top, Math.Min(area.Bottom - height, old.Y)), width, height);
    }
    internal void Write(string file) {
      Directory.CreateDirectory(Path.GetDirectoryName(file));
      var json = Json.Serialize(new { version = 1, bounds = new { x = Bounds.X, y = Bounds.Y, width = Bounds.Width, height = Bounds.Height }, maximized = Maximized, fullscreen = Fullscreen });
      File.WriteAllText(file + ".tmp", json);
      if (File.Exists(file)) File.Replace(file + ".tmp", file, null); else File.Move(file + ".tmp", file);
    }
  }
  internal static class Links {
    internal const string Origin = "https://keha-family.eldadkeha.workers.dev";
    internal const string Home = Origin + "/?source=windows-app#home";
    internal static bool Trusted(string value) {
      return Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.Authority == "keha-family.eldadkeha.workers.dev" && string.IsNullOrEmpty(uri.UserInfo);
    }
    internal static bool External(string value) {
      if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || !string.IsNullOrEmpty(uri.UserInfo)) return false;
      if (uri.Scheme == "mailto") return true;
      if (uri.Scheme != "https") return false;
      return Trusted(value) || new[] { "youtube.com", "youtu.be", "vimeo.com", "facebook.com", "messenger.com", "instagram.com", "wa.me", "whatsapp.com", "google.com", "github.com" }.Any(host => uri.Host == host || uri.Host.EndsWith("." + host, StringComparison.OrdinalIgnoreCase));
    }
  }
}
