`timescale 1ns/1ps
module sar_change_detector_tb;
    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg rst, valid_in;
    reg [7:0] pixel1, pixel2, threshold;
    wire change_out, valid_out;
    integer errors;

    sar_change_detector dut (
        .clk(clk), .rst(rst), .pixel1(pixel1), .pixel2(pixel2),
        .threshold(threshold), .valid_in(valid_in),
        .change_out(change_out), .valid_out(valid_out)
    );

    task check;
        input expected;
        begin
            @(posedge clk); #1;
            if (valid_out !== 1'b1 || change_out !== expected) begin
                $display("FAIL expected change=%b got=%b valid=%b", expected, change_out, valid_out);
                errors = errors + 1;
            end
        end
    endtask

    initial begin
        errors=0; rst=1; valid_in=0;
        pixel1=0; pixel2=0; threshold=0;
        repeat (2) @(posedge clk);
        @(negedge clk); rst=0;

        // Identical pixels: no change.
        pixel1=100; pixel2=100; threshold=10; valid_in=1; check(1'b0);
        // Difference equal to threshold: strict 'greater than' means no change.
        @(negedge clk); pixel1=40; pixel2=50; threshold=10; check(1'b0);
        // Difference one greater than threshold: change in either order.
        @(negedge clk); pixel1=40; pixel2=51; threshold=10; check(1'b1);
        @(negedge clk); pixel1=250; pixel2=5; threshold=200; check(1'b1);
        // Maximum possible difference (255), threshold zero.
        @(negedge clk); pixel1=0; pixel2=255; threshold=0; check(1'b1);

        // Invalid cycle suppresses valid_out.
        @(negedge clk); valid_in=0;
        @(posedge clk); #1;
        if (valid_out !== 1'b0) begin
            $display("FAIL invalid cycle asserted valid_out"); errors=errors+1;
        end

        if (errors==0) $display("PASS: sar_change_detector_tb");
        else $display("FAIL: %0d error(s)",errors);
        $finish;
    end
endmodule
