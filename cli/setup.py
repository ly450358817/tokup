from setuptools import setup, find_packages
setup(
    name="tokup-cli",
    version="0.1.0",
    packages=find_packages(),
    entry_points={"console_scripts": ["tokup = tokup_cli.main:main"]},
    python_requires=">=3.8",
    author="TokUp Team",
    description="TokUp AI API 网关切换与管理 CLI 工具",
    long_description="一键切换 AI API 网关，支持 OpenAI/Claude/DeepSeek。\n项目地址: https://github.com/ly450358817/tokup",
    long_description_content_type="text/markdown",
    url="https://github.com/ly450358817/tokup",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
    ],
)
