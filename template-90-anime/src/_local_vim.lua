vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = { "*.md", "*.js", "*.html", "*.css" },
  callback = function()
    local buf_dir = vim.fn.expand("%:p:h")
    local cmd

    if jit.os == "OSX" then
      cmd = { '../local-bin/slide-make.sh' }
      -- cmd = { '../local-bin/slide-join.sh' }
    else
      -- Windows用
      cmd = 'start "marp-convert" /i /min /b /d ' .. buf_dir
        .. '  cmd /c "..??mk-005.bat && exit 0 >> __debug.log 2>&1"'
    end

    vim.fn.jobstart(cmd, { detach = true })
  end,
})
-- vim: ts=2 sts=2 sw=2 et
