export const prompt = jest.fn().mockResolvedValue({});

const inquirer = {
    prompt,
};

export default inquirer;