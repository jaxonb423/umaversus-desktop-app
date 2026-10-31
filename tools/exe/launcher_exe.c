/* Uma Versus Modded.exe -- starts the bundled Python launcher (runtime\pythonw.exe app\launcher.py)
 * from the folder this exe is in. No console window. Built with tools/exe/build_exe.sh. */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

static void say(const wchar_t *msg) { MessageBoxW(NULL, msg, L"Uma Versus (Modded)", MB_OK | MB_ICONERROR); }

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE prev, PWSTR args, int show) {
    (void)inst; (void)prev; (void)show;
    wchar_t dir[MAX_PATH * 2], py[MAX_PATH * 2], script[MAX_PATH * 2], cmd[MAX_PATH * 6];
    DWORD n = GetModuleFileNameW(NULL, dir, MAX_PATH * 2);
    if (n == 0 || n >= MAX_PATH * 2) { say(L"Couldn't find where this program is."); return 1; }
    wchar_t *slash = wcsrchr(dir, L'\\');
    if (slash) *slash = 0;
    wsprintfW(py, L"%s\\runtime\\pythonw.exe", dir);
    wsprintfW(script, L"%s\\app\\launcher.py", dir);
    if (GetFileAttributesW(py) == INVALID_FILE_ATTRIBUTES || GetFileAttributesW(script) == INVALID_FILE_ATTRIBUTES) {
        say(L"The \"runtime\" or \"app\" folder is missing next to this program.\n\n"
            L"Unzip the WHOLE download first (right-click the zip > Extract All), "
            L"then start \"Uma Versus Modded.exe\" from inside the unzipped folder.");
        return 1;
    }
    /* pass our own arguments along (for example --mods-off) */
    wsprintfW(cmd, L"\"%s\" \"%s\" %s", py, script, (args && *args) ? args : L"");
    STARTUPINFOW si; PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof si); si.cb = sizeof si; ZeroMemory(&pi, sizeof pi);
    if (!CreateProcessW(py, cmd, NULL, NULL, FALSE, 0, NULL, dir, &si, &pi)) {
        wchar_t err[512];
        wsprintfW(err, L"Couldn't start the game (Windows error %lu).\n\nIf your antivirus blocked it, allow \"Uma Versus Modded\" or use app\\start.bat instead.", GetLastError());
        say(err);
        return 1;
    }
    CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
    return 0;
}
